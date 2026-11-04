const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Creating SystemSetting table if not exists...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SystemSetting" (
        "key" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
      );
    `);
    console.log('Table SystemSetting created or verified.');

    // Seed default setting: hide_payslips = 'true'
    console.log('Seeding initial setting: hide_payslips = true...');
    await prisma.$executeRawUnsafe(`
      INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
      VALUES ('hide_payslips', 'true', NOW())
      ON CONFLICT ("key") DO NOTHING;
    `);
    console.log('Successfully initialized hide_payslips setting to true.');

    const currentSetting = await prisma.systemSetting.findUnique({
      where: { key: 'hide_payslips' }
    });
    console.log('Current hide_payslips setting in DB:', currentSetting);

  } catch (error) {
    console.error('Error setting up SystemSetting table:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
