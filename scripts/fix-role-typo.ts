import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Detecting and fixing SUPER_ADMIN role typo...');

    // Since SUPERADMIN is not in the enum, we have to use raw SQL to find and update it
    // or use $executeRaw

    try {
        const updatedCount = await prisma.$executeRaw`
      UPDATE "User" 
      SET "role" = 'SUPER_ADMIN' 
      WHERE "role"::text = 'SUPERADMIN'
    `;

        console.log(`Successfully updated ${updatedCount} users with corrected SUPER_ADMIN role.`);
    } catch (error) {
        console.error('Error updating role typo:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
