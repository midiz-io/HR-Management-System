const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      where: { isResigned: false },
      orderBy: { createdAt: 'desc' },
    });
    console.log('Success, found', users.length, 'users');
  } catch (error) {
    console.error('Prisma Error:', error);
  }
}

main().finally(() => process.exit(0));
