const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  await p.oTRequest.findMany({ take: 1 });
  console.log('OTRequest OK');
  await p.salaryConfig.findMany({ take: 1 });
  console.log('SalaryConfig OK');
}

main()
  .catch((e) => {
    console.error('FAIL:', e.message);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
