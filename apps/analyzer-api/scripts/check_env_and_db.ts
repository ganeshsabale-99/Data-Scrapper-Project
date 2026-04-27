
import dotenv from "dotenv";
import path from "path";
import { prismaInstance } from "@repo/db";

// Load env same way as app.ts
dotenv.config();
if (!process.env.DATABASE_URL) {
    dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
}

// Fallback to local .env if needed (like getAllIndiaTechParks.ts)
if (!process.env.GOOGLE_API_KEY) {
    dotenv.config({ path: './src/.env' });
    dotenv.config({ path: '.env' });
}

console.log("--- ENV CHECK ---");
console.log("GOOGLE_API_KEY present:", !!process.env.GOOGLE_API_KEY);
if (process.env.GOOGLE_API_KEY) {
    console.log("GOOGLE_API_KEY prefix:", process.env.GOOGLE_API_KEY.substring(0, 5) + "...");
}

async function check() {
    console.log("--- DB CHECK ---");
    const techPark = await prismaInstance.newTechPark.findFirst({
        where: {
            name: { contains: "Amar Sadanand Tech Park", mode: "insensitive" }
        },
        select: {
            id: true,
            name: true,
            photo_url: true,
            exterior_media_urls: true
        }
    });

    if (techPark) {
        console.log("Found Tech Park:", techPark.name);
        console.log("Original photo_url:", techPark.photo_url);

        if (techPark.photo_url) {
            if (techPark.photo_url.includes("key=")) {
                console.log("URL contains key parameter.");
                const keyMatch = techPark.photo_url.match(/[?&]key=([^&]+)/);
                if (keyMatch) {
                    console.log("Extracted Key:", keyMatch[1].substring(0, 5) + "...");
                }
            }
        }
    } else {
        console.log("No Tech Park with name 'Amar Sadanand Tech Park' found.");
    }
}

check()
    .catch(console.error)
    .finally(() => prismaInstance.$disconnect());
