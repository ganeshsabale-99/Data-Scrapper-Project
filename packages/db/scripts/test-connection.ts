import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Attempting to connect to the database...');
        const result = await prisma.$queryRaw`SELECT 1 as connected`;
        console.log('Connection successful:', result);

        console.log('Attempting to query CityCatalog...');
        const cities = await prisma.cityCatalog.findMany({ take: 1 });
        console.log('Query successful, found:', cities.length, 'cities');
    } catch (error) {
        console.error('Connection failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
