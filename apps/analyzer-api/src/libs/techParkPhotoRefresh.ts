import axios from "axios";
import { prismaInstance } from "@repo/db";
import { logOperationalEvent } from "./serviceHealthLogger";

const API_KEY = process.env.GOOGLE_API_KEY;
const MAX_PHOTOS = 8;
const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface TechParkPhotoRefreshTarget {
  id: string;
  place_id?: string | null;
  exterior_media_urls?: string[];
  last_seen_at?: Date | null;
}

// Google Place Photo references are tied to the underlying place snapshot —
// when the place's data is refreshed on Google's side (rename, listing merge,
// re-index) old references start returning 400/403 even with a valid key.
// The only reliable fix is re-fetching fresh references via place_id.
export const isTechParkPhotoRefreshDue = (target: TechParkPhotoRefreshTarget): boolean => {
  if (!target.place_id) return false;
  if (!target.exterior_media_urls || target.exterior_media_urls.length === 0) return true;
  if (!target.last_seen_at) return true;
  return Date.now() - new Date(target.last_seen_at).getTime() > STALE_AFTER_MS;
};

export const refreshTechParkPhotos = async (
  target: TechParkPhotoRefreshTarget,
): Promise<string[] | null> => {
  if (!API_KEY || !target.place_id) return null;

  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/details/json",
      {
        params: {
          key: API_KEY,
          place_id: target.place_id,
          fields: "photos",
        },
        timeout: 12000,
      },
    );

    const photos: Array<{ photo_reference: string }> = response.data?.result?.photos ?? [];
    if (photos.length === 0) return null;

    const urls = photos.slice(0, MAX_PHOTOS).map(
      (photo) =>
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${API_KEY}`,
    );

    await prismaInstance.newTechPark.update({
      where: { id: target.id },
      data: {
        exterior_media_urls: urls,
        exterior_media_url: urls[0],
        last_seen_at: new Date(),
      },
    });

    logOperationalEvent("techpark.photo_refresh.completed", {
      techParkId: target.id,
      placeId: target.place_id,
      photoCount: urls.length,
    });

    return urls;
  } catch (error) {
    logOperationalEvent(
      "techpark.photo_refresh.failed",
      {
        techParkId: target.id,
        placeId: target.place_id,
        error: error instanceof Error ? error.message : String(error),
      },
      "warn",
    );
    return null;
  }
};
