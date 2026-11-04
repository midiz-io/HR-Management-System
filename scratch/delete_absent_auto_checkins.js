const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const startOfSept = new Date('2026-09-01T00:00:00.000Z');
  const endOfSept = new Date('2026-10-01T00:00:00.000Z');

  console.log('Finding auto check-in records in September 2026...');
  
  const recordsToDelete = await prisma.attendance.findMany({
    where: {
      checkInTime: {
        gte: startOfSept,
        lt: endOfSept,
      },
      notes: {
        contains: 'Auto check-in',
      },
    },
  });

  console.log(`Found ${recordsToDelete.length} auto check-in records in September.`);

  if (recordsToDelete.length > 0) {
    const res = await prisma.attendance.deleteMany({
      where: {
        id: {
          in: recordsToDelete.map(r => r.id),
        },
      },
    });
    console.log(`Successfully deleted ${res.count} records.`);
  } else {
    console.log('No records to delete.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
