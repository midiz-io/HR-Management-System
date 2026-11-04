const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TrashRecord" (
        "id" TEXT NOT NULL,
        "tableName" TEXT NOT NULL,
        "recordId" TEXT NOT NULL,
        "recordData" JSONB NOT NULL,
        "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TrashRecord_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TrashRecord_tableName_idx" ON "TrashRecord"("tableName")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TrashRecord_deletedAt_idx" ON "TrashRecord"("deletedAt")`);
    console.log('TrashRecord table created successfully!');
  } catch (error) {
    console.error('Prisma Error:', error);
  }
}

main().finally(() => process.exit(0));
