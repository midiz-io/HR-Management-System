const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { firstName: { contains: 'Thilini', mode: 'insensitive' } },
          { lastName: { contains: 'Fernando', mode: 'insensitive' } }
        ]
      }
    });
    console.log('Users matched:', users.length);
    for (const u of users) {
      console.log(`- ${u.firstName} ${u.lastName} (${u.email})`);
    }
  } catch (error) {
    console.error(error);
  }
}

main().finally(() => process.exit(0));
