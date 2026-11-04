const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Enabling Realtime for SystemSetting table...");
    
    // Check if it's already in the publication
    try {
      await prisma.$executeRawUnsafe(`
        BEGIN;
        -- Create the publication if it doesn't exist (Supabase usually has this by default)
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
                CREATE PUBLICATION supabase_realtime;
            END IF;
        END$$;
        
        -- Add the table to the publication
        ALTER PUBLICATION supabase_realtime ADD TABLE "SystemSetting";
        COMMIT;
      `);
      console.log("Successfully enabled realtime for SystemSetting.");
    } catch (e) {
      if (e.message.includes('already in publication')) {
         console.log("Table is already in publication. Skipping.");
      } else {
         console.log("Failed to alter publication. It might already be configured or lack permissions.", e.message);
      }
    }

    console.log("Seeding initial mobile permissions...");
    const initialPermissions = {
      attendance: true,
      leaveRequest: true,
      tasks: true,
      otRequest: true,
      foodOrder: true,
      salaryAdvance: true,
      gatePass: true,
      shortLeave: true
    };
    
    await prisma.systemSetting.upsert({
      where: { key: 'MOBILE_APP_PERMISSIONS' },
      update: {},
      create: {
        key: 'MOBILE_APP_PERMISSIONS',
        value: JSON.stringify(initialPermissions)
      }
    });
    console.log("Successfully seeded MOBILE_APP_PERMISSIONS.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
