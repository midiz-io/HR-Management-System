const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const http = require('http');

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!admin) {
    console.log("No super admin found");
    return;
  }
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/payroll/config?month=10&year=2026',
    method: 'GET',
    headers: {
      'Authorization': admin.id
    }
  };
  
  const req = http.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`);
    let data = '';
    res.on('data', d => {
      data += d;
    });
    res.on('end', () => {
      console.log(data.substring(0, 1000));
    });
  });
  
  req.on('error', error => {
    console.error(error);
  });
  
  req.end();
}

main();
