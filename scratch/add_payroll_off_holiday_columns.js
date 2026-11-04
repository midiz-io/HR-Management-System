/**
 * Adds offDayPay and holidayPay columns to Payroll table.
 * Run: node scratch/add_payroll_off_holiday_columns.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Adding offDayPay and holidayPay columns to Payroll...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Payroll"
    ADD COLUMN IF NOT EXISTS "offDayPay" DOUBLE PRECISION NOT NULL DEFAULT 0;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Payroll"
    ADD COLUMN IF NOT EXISTS "holidayPay" DOUBLE PRECISION NOT NULL DEFAULT 0;
  `);
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
