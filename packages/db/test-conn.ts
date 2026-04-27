import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Connecting to the database...');
        const users = await prisma.adminUser.findMany({ take: 1 });
        console.log('Successfully connected! Users found:', users.length);
    } catch (error) {
        console.error('Error connecting to the database:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
