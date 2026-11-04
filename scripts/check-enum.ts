import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking current UserRole enum values...');

    try {
        const results: any[] = await prisma.$queryRawUnsafe(`
      SELECT e.enumlabel
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      WHERE t.typname = 'UserRole'
    `);

        console.log('Current enum values:', results.map(r => r.enumlabel));
    } catch (error) {
        console.error('Error checking enum:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
