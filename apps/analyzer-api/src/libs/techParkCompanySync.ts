import cron from "node-cron";
import { prismaInstance } from "@repo/db";
import { discoverTechParkCompanies } from "./discoverTechParkCompanies";
import { logOperationalEvent } from "./serviceHealthLogger";
import { parseBooleanEnv } from "../utils/envUtils";
import { enrichCompanyRecordDetails, findCompanyWebsiteByName } from "./CompanyEnrichmentService";

type TechParkSyncTarget = {
  id: string;
  place_id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  locality?: string | null;
  address_line1?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type TechParkCompanySyncResult = {
  discovered: number;
  created: number;
  updated: number;
  reactivated: number;
  markedInactive: number;
};

export type TechParkCompanyDetailEnrichmentResult = {
  processed: number;
  updated: number;
};

export const syncCompaniesForTechPark = async (
  techPark: TechParkSyncTarget,
): Promise<TechParkCompanySyncResult> => {
  const discoveredCompanies = await discoverTechParkCompanies({
    place_id: techPark.place_id,
    name: techPark.name,
    city: techPark.city,
    state: techPark.state,
    locality: techPark.locality,
    address_line1: techPark.address_line1,
    lat: techPark.lat,
    lng: techPark.lng,
  });

  let createdCount = 0;
  let updatedCount = 0;
  let reactivatedCount = 0;
  const seenCompanyIds = new Set<string>();
  const now = new Date();

  for (const company of discoveredCompanies) {
    const locationHint = [company.city, techPark.city, techPark.state, techPark.name]
      .filter(Boolean)
      .join(" ");
    const addressHint = company.address || techPark.address_line1 || "";

    // Match by Google's place_id first — it's exact and stable across runs.
    // Fall back to fuzzy name/address matching only for legacy rows created
    // before place_id was tracked, so a re-sync migrates them forward instead
    // of creating a duplicate.
    const existingCompany =
      (await (prismaInstance as any).techParkCompany.findFirst({
        where: { place_id: company.place_id },
      })) ||
      (await (prismaInstance as any).techParkCompany.findFirst({
        where: {
          newTechParkId: techPark.id,
          place_id: null,
          OR: [
            {
              name: { equals: company.name, mode: "insensitive" },
              address: { equals: company.address, mode: "insensitive" },
            },
            {
              name: { equals: company.name, mode: "insensitive" },
            },
          ],
        },
      }));

    const resolvedWebsite =
      company.website ||
      existingCompany?.website ||
      await findCompanyWebsiteByName(company.name, locationHint, addressHint);

    if (existingCompany) {
      await (prismaInstance as any).techParkCompany.update({
        where: { id: existingCompany.id },
        data: {
          place_id: company.place_id,
          address: company.address || existingCompany.address,
          city: company.city || existingCompany.city,
          locationLat: company.locationLat || existingCompany.locationLat,
          locationLng: company.locationLng || existingCompany.locationLng,
          website: resolvedWebsite ?? existingCompany.website,
          description: company.description ?? existingCompany.description,
          operator: company.operator ?? existingCompany.operator,
          rating: company.rating ?? existingCompany.rating,
          total_ratings: company.total_ratings ?? existingCompany.total_ratings,
          types: company.types?.length ? company.types : existingCompany.types,
          plus_code: company.plus_code ?? existingCompany.plus_code,
          opening_hours: company.opening_hours?.length
            ? company.opening_hours
            : existingCompany.opening_hours,
          map_url: company.map_url ?? existingCompany.map_url,
          photo_reference: company.photo_reference ?? existingCompany.photo_reference,
          contact_phone: company.contact_phone ?? existingCompany.contact_phone,
          contact_international_phone:
            company.contact_international_phone ?? existingCompany.contact_international_phone,
          contact_email: company.contact_email ?? existingCompany.contact_email,
          isActive: true,
          firstSeenAt: existingCompany.firstSeenAt ?? now,
          lastSeenAt: now,
        },
      });
      if (existingCompany.isActive === false) reactivatedCount++;
      updatedCount++;
      seenCompanyIds.add(existingCompany.id);
      continue;
    }

    const created = await (prismaInstance as any).techParkCompany.create({
        data: {
          place_id: company.place_id,
          newTechParkId: techPark.id,
          name: company.name,
          address: company.address || techPark.address_line1 || "",
          city: company.city || techPark.city || "",
          locationLat: company.locationLat || 0,
          locationLng: company.locationLng || 0,
          website: resolvedWebsite,
          description: company.description,
          operator: company.operator,
        rating: company.rating,
        total_ratings: company.total_ratings,
        types: company.types || [],
        business_status: "NOT_CONTACTED",
        plus_code: company.plus_code,
        opening_hours: company.opening_hours || [],
        map_url: company.map_url,
        photo_reference: company.photo_reference,
        contact_phone: company.contact_phone,
        contact_international_phone: company.contact_international_phone,
        contact_email: company.contact_email,
        isActive: true,
        firstSeenAt: now,
        lastSeenAt: now,
      },
    });
    createdCount++;
    seenCompanyIds.add(created.id);
  }

  // Anything previously discovered for this tech park (i.e. has a place_id, so
  // it came from Google discovery rather than being manually added) that wasn't
  // found in this run is no longer present — mark it inactive rather than
  // deleting it, so "removed" companies stay visible with their history intact.
  const markInactiveResult = await (prismaInstance as any).techParkCompany.updateMany({
    where: {
      newTechParkId: techPark.id,
      place_id: { not: null },
      isActive: true,
      id: { notIn: Array.from(seenCompanyIds) },
    },
    data: { isActive: false },
  });
  const markedInactiveCount = markInactiveResult.count;

  const companiesMissingWebsite: Array<{
    id: string;
    name: string;
    city: string;
    address: string;
  }> = await (prismaInstance as any).techParkCompany.findMany({
    where: {
      newTechParkId: techPark.id,
      isActive: true,
      OR: [
        { website: null },
        { website: "" },
      ],
    },
    select: {
      id: true,
      name: true,
      city: true,
      address: true,
    },
  });

  for (const company of companiesMissingWebsite) {
    const locationHint = [company.city, techPark.city, techPark.state, techPark.name]
      .filter(Boolean)
      .join(" ");
    const addressHint = company.address || techPark.address_line1 || "";
    const website = await findCompanyWebsiteByName(company.name, locationHint, addressHint);
    if (!website) continue;

    await (prismaInstance as any).techParkCompany.update({
      where: { id: company.id },
      data: {
        website,
      },
    });
    updatedCount++;
  }

  return {
    discovered: discoveredCompanies.length,
    created: createdCount,
    updated: updatedCount,
    reactivated: reactivatedCount,
    markedInactive: markedInactiveCount,
  };
};

export const enrichCompaniesForTechPark = async (
  techPark: TechParkSyncTarget,
): Promise<TechParkCompanyDetailEnrichmentResult> => {
  const companies: Array<{
    id: string;
    name: string;
    address: string;
    city: string;
    website: string | null;
    description: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    map_url: string | null;
    rating: number | null;
    total_ratings: number | null;
    opening_hours: string[];
    business_status: string | null;
    types: string[];
    plus_code: string | null;
    photo_reference: string | null;
    locationLat: number | null;
    locationLng: number | null;
    linkedin_url: string | null;
    twitter_url: string | null;
    facebook_url: string | null;
    instagram_url: string | null;
    crunchbase_url: string | null;
  }> = await (prismaInstance as any).techParkCompany.findMany({
    where: {
      newTechParkId: techPark.id,
    },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      website: true,
      description: true,
      contact_email: true,
      contact_phone: true,
      map_url: true,
      rating: true,
      total_ratings: true,
      opening_hours: true,
      business_status: true,
      types: true,
      plus_code: true,
      photo_reference: true,
      locationLat: true,
      locationLng: true,
      linkedin_url: true,
      twitter_url: true,
      facebook_url: true,
      instagram_url: true,
      crunchbase_url: true,
    },
  });

  let updated = 0;

  for (const company of companies) {
    const locationHint = [company.city, techPark.city, techPark.state, techPark.name]
      .filter(Boolean)
      .join(" ");

    const enriched = await enrichCompanyRecordDetails({
      id: company.id,
      name: company.name,
      address: company.address,
      city: company.city,
      website: company.website,
    }, locationHint);

    const updateData: Record<string, string> = {};
    if (!company.website && enriched.website) updateData.website = enriched.website;
    if (!company.description && enriched.description) updateData.description = enriched.description;
    if (!company.contact_email && enriched.contact_email) updateData.contact_email = enriched.contact_email;
    if (!company.contact_phone && enriched.contact_phone) updateData.contact_phone = enriched.contact_phone;
    if (!company.map_url && enriched.map_url) updateData.map_url = enriched.map_url;
    if (!company.plus_code && enriched.plus_code) updateData.plus_code = enriched.plus_code;
    if (!company.photo_reference && enriched.photo_reference) updateData.photo_reference = enriched.photo_reference;
    if (!company.linkedin_url && enriched.linkedin_url) updateData.linkedin_url = enriched.linkedin_url;
    if (!company.twitter_url && enriched.twitter_url) updateData.twitter_url = enriched.twitter_url;
    if (!company.facebook_url && enriched.facebook_url) updateData.facebook_url = enriched.facebook_url;
    if (!company.instagram_url && enriched.instagram_url) updateData.instagram_url = enriched.instagram_url;
    if (!company.crunchbase_url && enriched.crunchbase_url) updateData.crunchbase_url = enriched.crunchbase_url;

    const structuredUpdateData: Record<string, unknown> = { ...updateData };
    if ((company.rating === null || company.rating === undefined) && typeof enriched.rating === "number") {
      structuredUpdateData.rating = enriched.rating;
    }
    if ((company.total_ratings === null || company.total_ratings === undefined) && typeof enriched.total_ratings === "number") {
      structuredUpdateData.total_ratings = enriched.total_ratings;
    }
    if ((!company.opening_hours || company.opening_hours.length === 0) && enriched.opening_hours?.length) {
      structuredUpdateData.opening_hours = enriched.opening_hours;
    }
    if ((!company.business_status || company.business_status === "NOT_CONTACTED") && enriched.business_status) {
      structuredUpdateData.business_status = enriched.business_status;
    }
    if ((!company.types || company.types.length === 0) && enriched.types?.length) {
      structuredUpdateData.types = enriched.types;
    }
    if ((company.locationLat === null || company.locationLat === undefined || company.locationLat === 0) && typeof enriched.locationLat === "number") {
      structuredUpdateData.locationLat = enriched.locationLat;
    }
    if ((company.locationLng === null || company.locationLng === undefined || company.locationLng === 0) && typeof enriched.locationLng === "number") {
      structuredUpdateData.locationLng = enriched.locationLng;
    }
    if ((!company.address || company.address.trim() === "") && enriched.address) {
      structuredUpdateData.address = enriched.address;
    }

    if (Object.keys(structuredUpdateData).length === 0) {
      continue;
    }

    await (prismaInstance as any).techParkCompany.update({
      where: { id: company.id },
      data: structuredUpdateData,
    });
    updated++;
  }

  return {
    processed: companies.length,
    updated,
  };
};

export const runTechParkCompanySync = async () => {
  const apiKeyPresent = Boolean(process.env.GOOGLE_API_KEY);
  if (!apiKeyPresent) {
    logOperationalEvent("techpark.company_sync.skipped", {
      reason: "missing_google_api_key",
    }, "warn");
    return;
  }

  const techParks = await prismaInstance.newTechPark.findMany({
    select: {
      id: true,
      place_id: true,
      name: true,
      city: true,
      state: true,
      locality: true,
      address_line1: true,
      lat: true,
      lng: true,
    },
  });

  let processed = 0;
  let failed = 0;
  let discovered = 0;
  let created = 0;
  let updated = 0;
  let reactivated = 0;
  let markedInactive = 0;
  let enrichmentProcessed = 0;
  let enrichmentUpdated = 0;
  let enrichmentFailed = 0;

  for (const techPark of techParks) {
    if (!techPark.place_id) {
      continue;
    }

    const target = { ...techPark, place_id: techPark.place_id };

    try {
      const result = await syncCompaniesForTechPark(target);
      processed++;
      discovered += result.discovered;
      created += result.created;
      updated += result.updated;
      reactivated += result.reactivated;
      markedInactive += result.markedInactive;
    } catch (error) {
      failed++;
      logOperationalEvent("techpark.company_sync.techpark_failed", {
        techParkId: techPark.id,
        techParkName: techPark.name,
        error: error instanceof Error ? error.message : String(error),
      }, "warn");
      // If discovery itself failed, there's nothing new to enrich for this park —
      // skip straight to the next one instead of enriching stale data.
      continue;
    }

    // Website/social-media/contact enrichment used to only run when someone
    // clicked "Discover Companies" in the UI. It now runs automatically as part
    // of the same nightly pass, right after discovery, so newly-found companies
    // get enriched without anyone having to remember to trigger it by hand.
    try {
      const enrichResult = await enrichCompaniesForTechPark(target);
      enrichmentProcessed += enrichResult.processed;
      enrichmentUpdated += enrichResult.updated;
    } catch (error) {
      enrichmentFailed++;
      logOperationalEvent("techpark.company_sync.enrichment_failed", {
        techParkId: techPark.id,
        techParkName: techPark.name,
        error: error instanceof Error ? error.message : String(error),
      }, "warn");
    }
  }

  logOperationalEvent("techpark.company_sync.completed", {
    processed,
    failed,
    discovered,
    created,
    updated,
    reactivated,
    markedInactive,
    enrichmentProcessed,
    enrichmentUpdated,
    enrichmentFailed,
  });
};

export const startTechParkCompanySyncScheduler = () => {
  const enabled = parseBooleanEnv(process.env.TECH_PARK_COMPANY_SYNC_ENABLED, true);
  if (!enabled) {
    logOperationalEvent("techpark.company_sync.disabled", {
      reason: "TECH_PARK_COMPANY_SYNC_ENABLED=false",
    });
    return;
  }

  const cronExpression = process.env.TECH_PARK_COMPANY_SYNC_CRON || "0 0 2 * * *";
  const timezone = process.env.TECH_PARK_COMPANY_SYNC_TIMEZONE || "Asia/Kolkata";
  let inFlight = false;

  cron.schedule(cronExpression, async () => {
    if (inFlight) {
      logOperationalEvent("techpark.company_sync.skipped", {
        reason: "previous_run_still_in_progress",
      }, "warn");
      return;
    }

    inFlight = true;
    try {
      await runTechParkCompanySync();
    } catch (error) {
      logOperationalEvent("techpark.company_sync.failed", {
        error: error instanceof Error ? error.message : String(error),
      }, "error");
    } finally {
      inFlight = false;
    }
  }, { timezone });

  logOperationalEvent("techpark.company_sync.started", {
    cronExpression,
    timezone,
  });
};
