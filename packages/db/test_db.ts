import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const tp = await prisma.newTechPark.findFirst();
  console.log("TechPark ID:", tp?.id);
}
run().catch(console.error).finally(() => prisma.$disconnect());
