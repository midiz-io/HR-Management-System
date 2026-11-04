const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "User_department_idx" ON "User"("department")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "User_isResigned_idx" ON "User"("isResigned")`);
    console.log('Indexes created successfully!');
  } catch (error) {
    console.error('Prisma Error:', error);
  }
}

main().finally(() => process.exit(0));
