process.env.DATABASE_URL = "postgresql://postgres:BBrviHp11eiv5iA8zqapMqvE7l0LhwSA@db.kvecywzxmudayezsvhie.supabase.co:5432/postgres";

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.payroll.count();
  console.log(`Prisma count payrolls: ${count}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
