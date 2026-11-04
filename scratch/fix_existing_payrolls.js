const fs = require('fs');
const path = require('path');

// Manually load .env file
try {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    env.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        process.env[key] = value.trim();
      }
    });
  }
} catch (e) {
  console.error('Error loading .env file:', e.message);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Querying payroll records with non-zero late deductions...');
  const records = await prisma.payroll.findMany({
    where: {
      lateDeductions: {
        gt: 0
      }
    }
  });

  console.log(`Found ${records.length} records to update.`);

  if (records.length === 0) {
    console.log('No records need updating.');
    return;
  }

  console.log('Starting transaction to update records...');
  
  const updates = records.map(record => {
    const oldNet = record.netSalary;
    const deduction = record.lateDeductions;
    const newNet = oldNet + deduction;

    console.log(`Queuing update for Payroll ID ${record.id} (${record.month}/${record.year}): ${oldNet} -> ${newNet}`);

    return prisma.payroll.update({
      where: { id: record.id },
      data: {
        lateDeductions: 0,
        netSalary: newNet
      }
    });
  });

  await prisma.$transaction(updates);
  console.log('Database transaction completed successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
