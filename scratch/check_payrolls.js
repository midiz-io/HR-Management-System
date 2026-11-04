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
  const remainingWithLate = await prisma.payroll.count({
    where: {
      lateDeductions: {
        gt: 0
      }
    }
  });
  console.log(`Remaining records with non-zero late deductions: ${remainingWithLate}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
