const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function exec(sql, label) {
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log(`OK: ${label}`);
  } catch (e) {
    console.log(`SKIP/ERR (${label}):`, e.message?.split('\n')[0] || e);
  }
}

async function main() {
  console.log('Adding incentive column to SalaryConfig...');
  await exec(`
    ALTER TABLE "SalaryConfig"
    ADD COLUMN IF NOT EXISTS "incentive" DOUBLE PRECISION NOT NULL DEFAULT 0;
  `, 'SalaryConfig.incentive');

  console.log('Adding incentive column to Payroll...');
  await exec(`
    ALTER TABLE "Payroll"
    ADD COLUMN IF NOT EXISTS "incentive" DOUBLE PRECISION NOT NULL DEFAULT 0;
  `, 'Payroll.incentive');

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
