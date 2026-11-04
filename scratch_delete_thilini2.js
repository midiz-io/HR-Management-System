const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { firstName: { contains: 'Thilini', mode: 'insensitive' } },
        { lastName: { contains: 'Fernando', mode: 'insensitive' } }
      ]
    }
  });

  console.log('Found users:', users.map(u => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email })));
  
  for (const user of users) {
     const allDeleted = await prisma.attendance.deleteMany({
      where: { userId: user.id }
     });
     console.log(`Deleted ${allDeleted.count} attendances for ${user.firstName} ${user.lastName}`);
  }
}

main().finally(() => process.exit(0));
