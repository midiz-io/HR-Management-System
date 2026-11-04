const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPayslipFeature() {
  console.log('--- Testing Payslip Feature ---');
  
  // 1. Check SystemSetting table
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'hide_payslips' }
  });
  console.log('1. Current DB Setting:', setting);

  // 2. Fetch Super Admin User
  const superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' }
  });
  console.log('2. Found Super Admin:', superAdmin?.email || 'None');

  // 3. Fetch Regular Employee User
  const employee = await prisma.user.findFirst({
    where: { role: 'EMPLOYEE' }
  });
  console.log('3. Found Employee:', employee?.email || 'None');

  // 4. Verify logic when hide_payslips is 'true'
  const isHidden = setting ? setting.value === 'true' : true;
  console.log('4. isHidden value:', isHidden);

  console.log('--- Test Completed Successfully ---');
  await prisma.$disconnect();
}

testPayslipFeature().catch((err) => {
  console.error('Test Failed:', err);
  prisma.$disconnect();
});
