const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRawUnsafe('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\'');
    console.log(result);
  } catch (error) {
    console.error('Prisma Error:', error);
  }
}

main().finally(() => process.exit(0));
