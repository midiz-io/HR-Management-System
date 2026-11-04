const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRawUnsafe('SELECT * FROM "User" LIMIT 2');
    console.log(result);
  } catch (error) {
    console.error('Prisma Error:', error);
  }
}

main().finally(() => process.exit(0));
