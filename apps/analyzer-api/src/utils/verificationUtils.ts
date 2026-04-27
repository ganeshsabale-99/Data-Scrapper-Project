import { prismaInstance } from "@repo/db";

/**
 * Calculates a duplication risk score (0-100) for a new tech park entry.
 * High score indicates a high probability that the entry is a duplicate.
 */
export const calculateDuplicationScore = async (params: {
    name: string;
    lat: number;
    lng: number;
    state: string;
    city: string;
    propertyManagerEmail?: string | null;
    spocPhone?: string | null;
}) => {
    const { name, lat, lng, state, city, propertyManagerEmail, spocPhone } = params;
    let score = 0;

    // 1. Proximity Check (Haversine distance)
    // Check for other tech parks within 300 meters
    const nearbyParks = await prismaInstance.$queryRaw<any[]>`
    SELECT id, name, lat, lng, distance
    FROM (
      SELECT id, name, lat, lng,
      (6371 * acos(least(1, greatest(-1, cos(radians(${lat})) * cos(radians(lat)) * cos(radians(lng) - radians(${lng})) + sin(radians(${lat})) * sin(radians(lat)))))) AS distance
      FROM tech_park."NewTechPark"
      WHERE state = ${state} AND city = ${city} AND is_active = true
    ) AS subquery
    WHERE distance < 0.3
  `;

    if (nearbyParks.length > 0) {
        // If there's a park extremely close (within 50m), give it a base score of 50
        const extremelyClose = nearbyParks.some(p => p.distance < 0.05);
        score += extremelyClose ? 50 : 30;
    }

    // 2. Name Similarity Check
    // We'll compare the new name with all tech parks in the same city
    const allParksInCity = await prismaInstance.newTechPark.findMany({
        where: { state, city, is_active: true },
        select: { name: true }
    });

    const normalizedNewName = normalizeName(name);
    let maxSimilarity = 0;

    for (const park of allParksInCity) {
        const similarity = sectionSimilarity(normalizedNewName, normalizeName(park.name));
        if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
        }
    }

    score += Math.floor(maxSimilarity * 50);

    // 3. Contact Info Reuse Check
    if (propertyManagerEmail || spocPhone) {
        const contactReuse = await prismaInstance.newTechPark.findFirst({
            where: {
                is_active: true,
                OR: [
                    ...(propertyManagerEmail ? [{ property_manager_email: propertyManagerEmail }] : []),
                    ...(spocPhone ? [{ spoc_phone: spocPhone }] : [])
                ]
            },
            select: { id: true, property_manager_email: true, spoc_phone: true }
        });

        if (contactReuse) {
            // Reusing contact info is a strong sign of duplicate or fake entry
            score += 40;
        }
    }

    return Math.min(100, score);
};

const normalizeName = (name: string) => {
    return name.toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .split(' ')
        .filter(w => w.length > 2 && !['tech', 'park', 'it', 'tower', 'building'].includes(w))
        .join(' ');
};

const sectionSimilarity = (s1: string, s2: string): number => {
    if (!s1 || !s2) return 0;
    const words1 = new Set(s1.split(' '));
    const words2 = new Set(s2.split(' '));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
};

/**
 * Calculates the Haversine distance between two points on Earth.
 * Returns distance in kilometers.
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};
