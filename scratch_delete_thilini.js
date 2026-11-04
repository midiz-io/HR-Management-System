const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { firstName: { contains: 'Thilini', mode: 'insensitive' } },
        { lastName: { contains: 'Fernando', mode: 'insensitive' } },
        { email: { contains: 'thilini', mode: 'insensitive' } }
      ]
    }
  });

  if (users.length > 0) {
    const thiliniId = users[0].id;
    console.log('Found Thilini:', users[0].email, 'ID:', thiliniId);
    
    // Delete auto checkin / checkout records
    const deleted = await prisma.attendance.deleteMany({
      where: { 
        userId: thiliniId,
        notes: { contains: 'Auto check' }
      }
    });
    console.log('Deleted auto attendances:', deleted.count);
    
    // Also delete any other attendances if she was absent
    const allDeleted = await prisma.attendance.deleteMany({
      where: { userId: thiliniId }
    });
    console.log('Deleted ALL remaining attendances for Thilini:', allDeleted.count);
  } else {
    console.log('Thilini not found');
  }
}

main().finally(() => process.exit(0));
