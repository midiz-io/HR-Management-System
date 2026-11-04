import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Adding SUPER_ADMIN to UserRole enum... (Simple Execute)');

    try {
        // Try adding the value directly. 
        // We catch the error if it already exists.
        try {
            await prisma.$executeRawUnsafe(`ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN'`);
            console.log('Successfully added SUPER_ADMIN to UserRole enum.');
        } catch (e: any) {
            if (e.message && e.message.includes('already exists')) {
                console.log('Value SUPER_ADMIN already exists in UserRole enum.');
            } else {
                throw e;
            }
        }

        // Now try to fix the typo
        console.log('Correcting SUPERADMIN -> SUPER_ADMIN typos...');
        const updatedCount = await prisma.$executeRawUnsafe(`
      UPDATE "User" 
      SET "role" = 'SUPER_ADMIN' 
      WHERE "role"::text = 'SUPERADMIN'
    `);

        console.log(`Successfully updated ${updatedCount} users with corrected SUPER_ADMIN role.`);
    } catch (error) {
        console.error('CRITICAL ERROR:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
