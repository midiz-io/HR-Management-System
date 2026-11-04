const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupDepartments() {
    console.log('🧹 Starting department cleanup...');

    try {
        // Step 1: Get all users with departments
        const users = await prisma.user.findMany({
            where: {
                department: {
                    not: null,
                },
            },
            select: {
                id: true,
                department: true,
                email: true,
            },
        });

        console.log(`📊 Found ${users.length} users with departments`);

        // Step 2: Trim and update departments
        let updatedCount = 0;
        let clearedCount = 0;

        for (const user of users) {
            if (user.department) {
                const trimmedDept = user.department.trim();

                if (trimmedDept !== user.department) {
                    // Update if different after trimming
                    if (trimmedDept === '') {
                        // Set to null if empty after trimming
                        await prisma.user.update({
                            where: { id: user.id },
                            data: { department: null },
                        });
                        console.log(`   Cleared empty department for: ${user.email}`);
                        clearedCount++;
                    } else {
                        // Update with trimmed value
                        await prisma.user.update({
                            where: { id: user.id },
                            data: { department: trimmedDept },
                        });
                        console.log(`   Updated "${user.department}" → "${trimmedDept}" for: ${user.email}`);
                        updatedCount++;
                    }
                }
            }
        }

        console.log(`\n✅ Updated ${updatedCount} department names`);
        console.log(`🗑️  Cleared ${clearedCount} empty departments`);

        // Step 3: Get unique departments after cleanup
        const uniqueDepartments = await prisma.user.findMany({
            where: {
                department: {
                    not: null,
                },
            },
            select: {
                department: true,
            },
            distinct: ['department'],
            orderBy: {
                department: 'asc',
            },
        });

        console.log('\n📋 Unique departments after cleanup:');
        uniqueDepartments.forEach((dept, index) => {
            console.log(`   ${index + 1}. ${dept.department}`);
        });

        console.log(`\n✨ Cleanup complete! Found ${uniqueDepartments.length} unique departments`);
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

cleanupDepartments()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
