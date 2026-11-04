const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      where: {
        firstName: { contains: 'Thilini', mode: 'insensitive' }
      }
    });

    if (users.length > 0) {
      console.log('Thilini found:', users[0].id, users[0].email);
      const attendances = await prisma.attendance.findMany({
        where: { userId: users[0].id },
        orderBy: { checkInTime: 'desc' }
      });
      console.log('Total attendances for Thilini:', attendances.length);
    } else {
      console.log('Thilini not found');
    }
  } catch(e) {
    console.error(e);
  }
}

main().finally(() => process.exit(0));
