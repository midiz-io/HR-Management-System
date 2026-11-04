const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Adding otPay column to Payroll table...');
    await prisma.$executeRawUnsafe('ALTER TABLE "Payroll" ADD COLUMN IF NOT EXISTS "otPay" DOUBLE PRECISION DEFAULT 0;');
    console.log('Success!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
