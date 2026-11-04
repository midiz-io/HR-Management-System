/**
 * Aligns PostgreSQL with Prisma schema for payroll & OT.
 * Run: node scratch/fix_payroll_database.js
 */
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
  console.log('Fixing OTStatus enum...');
  await exec(`
    DO $$ BEGIN
      CREATE TYPE "OTStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `, 'create OTStatus enum');

  await exec(`
    ALTER TABLE "OTRequest"
      ALTER COLUMN "status" DROP DEFAULT;
  `, 'OTRequest drop status default');

  await exec(`
    ALTER TABLE "OTRequest"
      ALTER COLUMN "status" TYPE "OTStatus"
      USING (
        CASE UPPER(TRIM("status"::text))
          WHEN 'PENDING' THEN 'PENDING'::"OTStatus"
          WHEN 'APPROVED' THEN 'APPROVED'::"OTStatus"
          WHEN 'REJECTED' THEN 'REJECTED'::"OTStatus"
          WHEN 'CANCELLED' THEN 'CANCELLED'::"OTStatus"
          ELSE 'PENDING'::"OTStatus"
        END
      );
  `, 'OTRequest status -> OTStatus');

  await exec(`
    ALTER TABLE "OTRequest"
      ALTER COLUMN "status" SET DEFAULT 'PENDING'::"OTStatus";
  `, 'OTRequest status default');

  console.log('Fixing PayrollStatus enum...');
  await exec(`
    DO $$ BEGIN
      CREATE TYPE "PayrollStatus" AS ENUM ('PENDING', 'PROCESSED', 'APPROVED', 'PAID', 'CANCELLED');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `, 'create PayrollStatus enum');

  await exec(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Payroll' AND column_name = 'status'
          AND udt_name = 'text'
      ) THEN
        ALTER TABLE "Payroll" ALTER COLUMN "status" DROP DEFAULT;
        ALTER TABLE "Payroll" ALTER COLUMN "status" TYPE "PayrollStatus"
          USING (
            CASE UPPER(TRIM("status"::text))
              WHEN 'PENDING' THEN 'PENDING'::"PayrollStatus"
              WHEN 'PROCESSED' THEN 'PROCESSED'::"PayrollStatus"
              WHEN 'APPROVED' THEN 'APPROVED'::"PayrollStatus"
              WHEN 'PAID' THEN 'PAID'::"PayrollStatus"
              WHEN 'CANCELLED' THEN 'CANCELLED'::"PayrollStatus"
              ELSE 'PENDING'::"PayrollStatus"
            END
          );
        ALTER TABLE "Payroll" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"PayrollStatus";
      END IF;
    END $$;
  `, 'Payroll status -> PayrollStatus');

  console.log('Fixing SalaryConfig columns...');
  await exec(`
    ALTER TABLE "SalaryConfig"
    ADD COLUMN IF NOT EXISTS "offDaysCount" DOUBLE PRECISION NOT NULL DEFAULT 0;
  `, 'SalaryConfig.offDaysCount');

  for (const col of ['salaryAdvance', 'loanDeduction', 'pendingBills']) {
    await exec(`
      ALTER TABLE "SalaryConfig"
      ADD COLUMN IF NOT EXISTS "${col}" DOUBLE PRECISION NOT NULL DEFAULT 0;
    `, `SalaryConfig.${col}`);
  }

  console.log('Fixing Payroll columns...');
  for (const col of [
    'salaryAdvance',
    'loanDeduction',
    'pendingBills',
    'otPay',
    'offDayPay',
    'holidayPay',
  ]) {
    await exec(`
      ALTER TABLE "Payroll"
      ADD COLUMN IF NOT EXISTS "${col}" DOUBLE PRECISION NOT NULL DEFAULT 0;
    `, `Payroll.${col}`);
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
