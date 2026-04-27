
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

async function check() {
    console.log("--- IMAGE FETCH VERIFICATION ---");

    if (!process.env.GOOGLE_API_KEY) {
        console.log("❌ Missing GOOGLE_API_KEY");
        return;
    }

    // 1. Validate API Key
    console.log("--- 1. KEY VALIDITY CHECK ---");
    try {
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=test&key=${process.env.GOOGLE_API_KEY}`;
        const searchResp = await axios.get(searchUrl);
        if (searchResp.data.status === 'OK' || searchResp.data.status === 'ZERO_RESULTS') {
            console.log("✅ API Key is Valid for Places API.");
        } else {
            console.log("❌ API Key Error:", searchResp.data.status, searchResp.data.error_message);
            return;
        }
    } catch (e: any) {
        console.log("❌ API Key Check Failed:", e.message);
        return;
    }

    // 2. Get Tech Park Data
    const techPark = await prismaInstance.newTechPark.findFirst({
        where: {
            name: { contains: "Amar Sadanand Tech Park", mode: "insensitive" }
        },
        select: {
            id: true,
            name: true,
            place_id: true, // Fetch place_id to try refreshing if needed
            photo_url: true
        }
    });

    if (!techPark || !techPark.photo_url) {
        console.log("Tech Park or photo_url not found");
        return;
    }

    // 3. Construct Photo URL
    let finalPhotoUrl = techPark.photo_url;
    if (finalPhotoUrl.startsWith("http") && finalPhotoUrl.includes("key=")) {
        finalPhotoUrl = finalPhotoUrl.replace(/([?&]key=)([^&]+)/, `$1${process.env.GOOGLE_API_KEY}`);
    } else if (!finalPhotoUrl.startsWith("http")) {
        finalPhotoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${finalPhotoUrl}&key=${process.env.GOOGLE_API_KEY}`;
    }

    console.log("\n--- 2. PHOTO FETCH CHECK ---");
    console.log("Testing URL:", finalPhotoUrl);

    try {
        const response = await axios.get(finalPhotoUrl, {
            maxRedirects: 5,
            validateStatus: null
        });

        console.log("Status Code:", response.status);

        if (response.status === 200 && response.headers['content-type']?.startsWith('image')) {
            console.log("✅ SUCCESS: Image is accessible.");
        } else {
            console.log("❌ FAILURE: Image fetch failed.");
            // If failed, try to get new details using place_id
            if (techPark.place_id) {
                console.log("\n--- 3. REFRESH EXPERIMENT ---");
                console.log("Attempting to get fresh details for place_id:", techPark.place_id);
                const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${techPark.place_id}&fields=photos&key=${process.env.GOOGLE_API_KEY}`;
                const detailsResp = await axios.get(detailsUrl);

                if (detailsResp.data.result?.photos?.[0]?.photo_reference) {
                    const newRef = detailsResp.data.result.photos[0].photo_reference;
                    console.log("Found NEW Photo Reference:", newRef.substring(0, 20) + "...");

                    const newPhotoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${newRef}&key=${process.env.GOOGLE_API_KEY}`;
                    console.log("Testing NEW Photo URL...");
                    const newPhotoResp = await axios.get(newPhotoUrl, { validateStatus: null });
                    console.log("New Photo Status:", newPhotoResp.status);
                    if (newPhotoResp.status === 200) {
                        console.log("✅ SUCCESS: New reference works. The old one was likely expired.");
                    } else {
                        console.log("❌ FAILURE: New reference also failed.");
                    }
                } else {
                    console.log("No photos found in fresh Details API response.");
                }
            }
        }

    } catch (error: any) {
        console.error("❌ ERROR during fetch:", error.message);
    }
}

check()
    .catch(console.error)
    .finally(() => prismaInstance.$disconnect());
