const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) return console.log('no user');

    const req = await prisma.gatePassRequest.create({
      data: {
        userId: user.id,
        date: new Date(),
        timeOut: '10:00',
        purpose: 'test'
      }
    });
    console.log('Success:', req);
  } catch (e) {
    console.error('Prisma Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
