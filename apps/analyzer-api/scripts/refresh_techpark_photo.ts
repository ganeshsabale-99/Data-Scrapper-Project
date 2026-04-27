
import dotenv from "dotenv";
import path from "path";
import { prismaInstance } from "@repo/db";
import axios from "axios";

// Load env same way as app.ts
dotenv.config();
if (!process.env.DATABASE_URL) {
    dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
}
if (!process.env.GOOGLE_API_KEY) {
    dotenv.config({ path: './src/.env' });
    dotenv.config({ path: '.env' });
}

async function refresh() {
    console.log("--- REFRESH TECH PARK PHOTO ---");

    if (!process.env.GOOGLE_API_KEY) {
        console.log("❌ Missing GOOGLE_API_KEY");
        return;
    }

    // 1. Find Tech Park
    const techPark = await prismaInstance.newTechPark.findFirst({
        where: {
            name: { contains: "Amar Sadanand Tech Park", mode: "insensitive" }
        },
        select: {
            id: true,
            name: true,
            place_id: true
        }
    });

    if (!techPark || !techPark.place_id) {
        console.log("Tech Park or place_id not found");
        return;
    }

    console.log(`Found Tech Park: ${techPark.name} (${techPark.id})`);
    console.log(`Place ID: ${techPark.place_id}`);

    // 2. Fetch Fresh Details
    try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${techPark.place_id}&fields=photos&key=${process.env.GOOGLE_API_KEY}`;
        const detailsResp = await axios.get(detailsUrl);

        const photos = detailsResp.data.result?.photos;
        if (photos && photos.length > 0) {
            const newRef = photos[0].photo_reference;
            console.log("Found NEW Photo Reference:", newRef.substring(0, 20) + "...");

            // Construct new URL (using reference, key will be appended dynamically by controller or we can store full URL)
            // Best practice: Store the reference or full URL. The existing schema stores full URL basically.
            // Let's store the reference mainly, or the full URL.
            // The controller logic now handles references if they don't start with http, OR full URLs.
            // Let's store the reference string directly to be cleaner? 
            // BUT existing logic expects `photo_url`. 
            // If I store just `ATCDN...` the controller will construct:
            // `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=ATCDN...&key=...`
            // This is safer as key can be rotated easily.

            // Let's update it to just the reference string!
            // Wait, check schema type. String.

            // Actually, let's stick to what other rows have to be consistent?
            // Other rows have full URLs.
            // But storing just the reference is smarter given my new controller logic.
            // Let's store just the REFERENCE for this one, and my controller logic handles `!finalPhotoUrl.startsWith("http")`.

            await prismaInstance.newTechPark.update({
                where: { id: techPark.id },
                data: {
                    photo_url: newRef, // Storing reference only
                    exterior_media_urls: photos.map((p: any) =>
                        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${p.photo_reference}&key=${process.env.GOOGLE_API_KEY}`
                    )
                }
            });

            console.log("✅ Database updated successfully with new photo reference.");
        } else {
            console.log("No photos found in fresh Details API response.");
        }

    } catch (error: any) {
        console.error("❌ ERROR during refresh:", error.message);
    }
}

refresh()
    .catch(console.error)
    .finally(() => prismaInstance.$disconnect());
