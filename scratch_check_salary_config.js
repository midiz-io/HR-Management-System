const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const count = await prisma.salaryConfig.count();
  console.log(`SalaryConfig count: ${count}`);
}

check().finally(() => process.exit(0));
