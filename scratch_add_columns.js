const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryConfig" ADD COLUMN "otAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0, ADD COLUMN "otherAllowances" DOUBLE PRECISION NOT NULL DEFAULT 0`);
    console.log("Added otAllowance and otherAllowances to SalaryConfig");
  } catch (e) {
    console.error(e.message);
  }

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Payroll" ADD COLUMN "otAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0, ADD COLUMN "otherAllowances" DOUBLE PRECISION NOT NULL DEFAULT 0`);
    console.log("Added otAllowance and otherAllowances to Payroll");
  } catch (e) {
    console.error(e.message);
  }
}
main().finally(() => process.exit(0));
