const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Creating SalaryConfig table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SalaryConfig" (
        "id" TEXT NOT NULL,
        "userId" UUID NOT NULL,
        "basicSalary" DOUBLE PRECISION NOT NULL,
        "allowances" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "deductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "epfEmployee" DOUBLE PRECISION NOT NULL DEFAULT 8,
        "epfEmployer" DOUBLE PRECISION NOT NULL DEFAULT 12,
        "etfEmployer" DOUBLE PRECISION NOT NULL DEFAULT 3,
        "bankName" TEXT,
        "accountNumber" TEXT,
        "branchName" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "SalaryConfig_pkey" PRIMARY KEY ("id")
      );
    `);

    console.log('Creating Payroll table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Payroll" (
        "id" TEXT NOT NULL,
        "userId" UUID NOT NULL,
        "month" INTEGER NOT NULL,
        "year" INTEGER NOT NULL,
        "basicSalary" DOUBLE PRECISION NOT NULL,
        "allowances" DOUBLE PRECISION NOT NULL,
        "deductions" DOUBLE PRECISION NOT NULL,
        "attendanceBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "lateDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "epfAmount" DOUBLE PRECISION NOT NULL,
        "etfAmount" DOUBLE PRECISION NOT NULL,
        "netSalary" DOUBLE PRECISION NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "paidAt" TIMESTAMP(3),
        "paysheetUrl" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
      );
    `);

    console.log('Creating indexes...');
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "SalaryConfig_userId_key" ON "SalaryConfig"("userId")`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Payroll_userId_month_year_key" ON "Payroll"("userId", "month", "year")`);

    console.log('Creating foreign keys...');
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryConfig" ADD CONSTRAINT "SalaryConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    } catch (e) { console.log('SalaryConfig FK might already exist'); }
    
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    } catch (e) { console.log('Payroll FK might already exist'); }

    console.log('Database schema updated successfully.');
  } catch (error) {
    console.error('Error updating schema:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
