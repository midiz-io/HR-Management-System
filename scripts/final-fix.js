const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Database Fix Start ---');

    try {
        // 1. Add SUPER_ADMIN to the enum if it doesn't exist
        console.log('Checking/Adding SUPER_ADMIN value to UserRole enum...');
        try {
            // Direct SQL to add value - Postgres doesn't allow this inside a transaction usually,
            // but Prisma's $executeRawUnsafe might work depending on connection pooling.
            await prisma.$executeRawUnsafe(`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN'`);
            console.log('Checked SUPER_ADMIN value.');
        } catch (e) {
            // pg 9.6+ supports IF NOT EXISTS, but if it fails, it might already exist
            if (e.message.includes('already exists')) {
                console.log('SUPER_ADMIN already exists.');
            } else {
                console.log('Notice: Could not add enum value via script (might need Supabase dashboard):', e.message);
            }
        }

        // 2. Fix the typos
        console.log('Updating users with role "SUPERADMIN" to "SUPER_ADMIN"...');
        const result = await prisma.$executeRawUnsafe(`
      UPDATE "User" 
      SET "role" = 'SUPER_ADMIN' 
      WHERE "role"::text = 'SUPERADMIN'
    `);

        console.log(`Update complete. Rows affected: ${result}`);

        if (result === 0) {
            console.log('No users found with role "SUPERADMIN". Checking if any already have "SUPER_ADMIN"...');
            const count = await prisma.$queryRawUnsafe(`SELECT count(*) FROM "User" WHERE "role"::text = 'SUPER_ADMIN'`);
            console.log('Users with SUPER_ADMIN role:', count);
        }

    } catch (error) {
        console.error('Error during database update:', error);
    } finally {
        await prisma.$disconnect();
        console.log('--- Database Fix End ---');
    }
}

main();
