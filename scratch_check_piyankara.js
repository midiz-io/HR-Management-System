const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      where: {
        firstName: { contains: 'Piyankara', mode: 'insensitive' }
      }
    });
    console.log(users.map(u => ({ name: u.firstName + ' ' + u.lastName, role: u.role })));
  } catch(e) {
    console.error(e);
  }
}

main().finally(() => process.exit(0));
