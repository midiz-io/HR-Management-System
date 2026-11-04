import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Adding SUPER_ADMIN to UserRole enum in database...');

    try {
        // We use $executeRawUnsafe because ALTER TYPE cannot be used in a transaction 
        // and sometimes Prisma wraps $executeRaw in one depending on the driver.
        // Also, we check if it exists first to avoid "already exists" errors.

        await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type t 
                       JOIN pg_enum e ON t.oid = e.enumtypid 
                       WHERE t.typname = 'UserRole' AND e.enumlabel = 'SUPER_ADMIN') THEN
          ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';
        END IF;
      END
      $$;
    `);

        console.log('Successfully added SUPER_ADMIN to UserRole enum.');

        // Now try to fix the typo
        const updatedCount = await prisma.$executeRawUnsafe(`
      UPDATE "User" 
      SET "role" = 'SUPER_ADMIN' 
      WHERE "role"::text = 'SUPERADMIN'
    `);

        console.log(`Successfully updated ${updatedCount} users with corrected SUPER_ADMIN role.`);
    } catch (error) {
        console.error('Error during database update:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
