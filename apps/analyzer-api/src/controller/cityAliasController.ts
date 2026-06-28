import { prismaInstance } from "@repo/db";
import { Request, Response } from "express";
import { invalidateCityAliasCache } from "../utils/cityNormalization";

// GET /city-aliases
export const listCityAliases = async (_req: Request, res: Response) => {
  try {
    const aliases = await prismaInstance.cityAlias.findMany({
      orderBy: [{ canonicalCity: "asc" }, { alias: "asc" }],
    });
    return res.status(200).json({ success: true, data: aliases });
  } catch (err) {
    return res.status(500).json({ success: false, message: String(err) });
  }
};

// POST /city-aliases
export const createCityAlias = async (req: Request, res: Response) => {
  try {
    const { alias, canonicalCity } = req.body as {
      alias?: string;
      canonicalCity?: string;
    };
    if (!alias?.trim() || !canonicalCity?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "alias and canonicalCity are required" });
    }

    const record = await prismaInstance.cityAlias.create({
      data: {
        alias: alias.trim().toLowerCase(),
        canonicalCity: canonicalCity.trim(),
      },
    });

    invalidateCityAliasCache();
    return res.status(201).json({ success: true, data: record });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res
        .status(409)
        .json({ success: false, message: "Alias already exists" });
    }
    return res.status(500).json({ success: false, message: String(err) });
  }
};

// PUT /city-aliases/:id
export const updateCityAlias = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { alias, canonicalCity, isActive } = req.body as {
      alias?: string;
      canonicalCity?: string;
      isActive?: boolean;
    };

    const data: Record<string, unknown> = {};
    if (alias !== undefined) data.alias = alias.trim().toLowerCase();
    if (canonicalCity !== undefined) data.canonicalCity = canonicalCity.trim();
    if (isActive !== undefined) data.isActive = isActive;

    if (Object.keys(data).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No fields to update" });
    }

    const record = await prismaInstance.cityAlias.update({
      where: { id },
      data,
    });

    invalidateCityAliasCache();
    return res.status(200).json({ success: true, data: record });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return res.status(404).json({ success: false, message: "Alias not found" });
    }
    if (err?.code === "P2002") {
      return res
        .status(409)
        .json({ success: false, message: "Alias already exists" });
    }
    return res.status(500).json({ success: false, message: String(err) });
  }
};

// DELETE /city-aliases/:id
export const deleteCityAlias = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await prismaInstance.cityAlias.delete({ where: { id } });
    invalidateCityAliasCache();
    return res.status(200).json({ success: true, message: "Deleted" });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return res.status(404).json({ success: false, message: "Alias not found" });
    }
    return res.status(500).json({ success: false, message: String(err) });
  }
};

// POST /city-aliases/bulk  — upsert many at once
// Body: { entries: [{ alias, canonicalCity }] }
export const bulkUpsertCityAliases = async (req: Request, res: Response) => {
  try {
    const entries = req.body?.entries as
      | { alias: string; canonicalCity: string }[]
      | undefined;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "entries array is required" });
    }

    let created = 0;
    let updated = 0;

    for (const { alias, canonicalCity } of entries) {
      if (!alias?.trim() || !canonicalCity?.trim()) continue;

      const aliasLower = alias.trim().toLowerCase();
      const result = await prismaInstance.cityAlias.upsert({
        where: { alias: aliasLower },
        update: { canonicalCity: canonicalCity.trim(), isActive: true },
        create: {
          alias: aliasLower,
          canonicalCity: canonicalCity.trim(),
        },
      });

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++;
      } else {
        updated++;
      }
    }

    invalidateCityAliasCache();
    return res.status(200).json({ success: true, created, updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: String(err) });
  }
};

// POST /city-aliases/invalidate-cache
export const invalidateAliasCache = (_req: Request, res: Response) => {
  invalidateCityAliasCache();
  return res.status(200).json({ success: true, message: "Cache invalidated" });
};
