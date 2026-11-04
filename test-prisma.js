const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const id = '123e4567-e89b-12d3-a456-426614174000'; // dummy UUID
  try {
    await prisma.$transaction(async (tx) => {
      await tx.attendance.deleteMany({ where: { userId: id } });
      await tx.leaveRequest.deleteMany({ where: { userId: id } });
      await tx.leaveBalance.deleteMany({ where: { userId: id } });
      await tx.payroll.deleteMany({ where: { userId: id } });
      await tx.oTRequest.deleteMany({ where: { userId: id } });
      await tx.salaryAdvanceRequest.deleteMany({ where: { userId: id } });
      await tx.gatePassRequest.deleteMany({ where: { userId: id } });
      await tx.shortLeaveRequest.deleteMany({ where: { userId: id } });
      await tx.foodOrder.deleteMany({ where: { userId: id } });
      await tx.task.deleteMany({ where: { assignedToId: id } });
      await tx.taskMessage.deleteMany({ where: { userId: id } });
      await tx.notificationSubscription.deleteMany({ where: { userId: id } });
      await tx.roster.deleteMany({ where: { userId: id } });
      await tx.salaryConfig.deleteMany({ where: { userId: id } });
      await tx.lateAttendanceTracker.deleteMany({ where: { userId: id } });
    });
    console.log("SUCCESS");
  } catch (error) {
    console.error("ERROR:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
