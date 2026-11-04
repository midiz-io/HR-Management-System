import prisma from '@/lib/prisma';

let isEnsuringPromise: Promise<void> | null = null;
let isEnsured = false;

export async function ensureSectionalHeadAndNewTables() {
  if (isEnsured) return;
  if (isEnsuringPromise) return isEnsuringPromise;

  isEnsuringPromise = (async () => {
    try {
    // 1. Safely add SECTIONAL_HEAD to UserRole enum if not present
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SECTIONAL_HEAD'`);
    } catch (_) {
      // Postgres might throw if already exists
    }

    const ddlStatements = [
      // 2. DepartmentMessage
      `CREATE TABLE IF NOT EXISTS "DepartmentMessage" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "departmentId" TEXT NOT NULL,
        "senderId" UUID NOT NULL,
        "message" TEXT NOT NULL,
        "attachments" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS "DepartmentMessage_departmentId_idx" ON "DepartmentMessage"("departmentId")`,
      `CREATE INDEX IF NOT EXISTS "DepartmentMessage_createdAt_idx" ON "DepartmentMessage"("createdAt" DESC)`,

      // 3. OffDayRequest
      `CREATE TABLE IF NOT EXISTS "OffDayRequest" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" UUID NOT NULL,
        "departmentId" TEXT,
        "date" TIMESTAMP(3) NOT NULL,
        "reason" TEXT,
        "status" TEXT NOT NULL DEFAULT 'PENDING_SECTIONAL_HEAD',
        "reviewerId" UUID,
        "reviewedAt" TIMESTAMP(3),
        "rejectionReason" TEXT,
        "recommendedById" UUID,
        "recommendedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS "OffDayRequest_userId_idx" ON "OffDayRequest"("userId")`,
      `CREATE INDEX IF NOT EXISTS "OffDayRequest_departmentId_idx" ON "OffDayRequest"("departmentId")`,
      `CREATE INDEX IF NOT EXISTS "OffDayRequest_date_idx" ON "OffDayRequest"("date")`,
      `CREATE INDEX IF NOT EXISTS "OffDayRequest_status_idx" ON "OffDayRequest"("status")`,

      // 4. SeafoodItem
      `CREATE TABLE IF NOT EXISTS "SeafoodItem" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL UNIQUE,
        "description" TEXT,
        "category" TEXT NOT NULL DEFAULT 'Fish',
        "unit" TEXT NOT NULL DEFAULT 'kg',
        "unitPrice" DOUBLE PRECISION NOT NULL,
        "inStock" BOOLEAN NOT NULL DEFAULT TRUE,
        "imageUrl" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,

      // 5. SeafoodOrder & SeafoodOrderItem
      `CREATE TABLE IF NOT EXISTS "SeafoodOrder" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "invoiceNo" TEXT NOT NULL UNIQUE,
        "userId" UUID NOT NULL,
        "totalAmount" DOUBLE PRECISION NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'ORDERED',
        "isDispatchedBySales" BOOLEAN NOT NULL DEFAULT FALSE,
        "dispatchedAt" TIMESTAMP(3),
        "dispatchedById" UUID,
        "isReceivedByEmployee" BOOLEAN NOT NULL DEFAULT FALSE,
        "receivedAt" TIMESTAMP(3),
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS "SeafoodOrder_userId_idx" ON "SeafoodOrder"("userId")`,
      `CREATE INDEX IF NOT EXISTS "SeafoodOrder_status_idx" ON "SeafoodOrder"("status")`,
      `CREATE INDEX IF NOT EXISTS "SeafoodOrder_createdAt_idx" ON "SeafoodOrder"("createdAt" DESC)`,

      `CREATE TABLE IF NOT EXISTS "SeafoodOrderItem" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "orderId" TEXT NOT NULL,
        "itemId" TEXT NOT NULL,
        "quantity" DOUBLE PRECISION NOT NULL,
        "unitPrice" DOUBLE PRECISION NOT NULL,
        "subtotal" DOUBLE PRECISION NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "SeafoodOrderItem_orderId_idx" ON "SeafoodOrderItem"("orderId")`,

      // 6. PendingBillAccount & PendingBillPayment
      `CREATE TABLE IF NOT EXISTS "PendingBillAccount" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" UUID NOT NULL,
        "month" INTEGER NOT NULL,
        "year" INTEGER NOT NULL,
        "totalBilled" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "cashPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "outstandingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "isSalaryDeductionConfirmed" BOOLEAN NOT NULL DEFAULT FALSE,
        "confirmedDeductionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "salaryDeductionConfirmedAt" TIMESTAMP(3),
        "confirmedById" UUID,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PendingBillAccount_user_month_year_unique" UNIQUE ("userId", "month", "year")
      )`,
      `CREATE INDEX IF NOT EXISTS "PendingBillAccount_userId_idx" ON "PendingBillAccount"("userId")`,
      `CREATE INDEX IF NOT EXISTS "PendingBillAccount_month_year_idx" ON "PendingBillAccount"("month", "year")`,

      `CREATE TABLE IF NOT EXISTS "PendingBillPayment" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "accountId" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "paymentType" TEXT NOT NULL DEFAULT 'CASH',
        "recordedById" UUID,
        "receiptNo" TEXT,
        "notes" TEXT,
        "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS "PendingBillPayment_accountId_idx" ON "PendingBillPayment"("accountId")`,

      // 7. DepartmentNotice & NoticeReadStatus
      `CREATE TABLE IF NOT EXISTS "DepartmentNotice" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "title" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "imageUrl" TEXT,
        "departmentId" TEXT,
        "departmentName" TEXT,
        "priority" TEXT NOT NULL DEFAULT 'NORMAL',
        "authorId" UUID NOT NULL,
        "authorName" TEXT,
        "authorRole" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "expiresAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS "DepartmentNotice_departmentId_idx" ON "DepartmentNotice"("departmentId")`,
      `CREATE INDEX IF NOT EXISTS "DepartmentNotice_authorId_idx" ON "DepartmentNotice"("authorId")`,
      `CREATE INDEX IF NOT EXISTS "DepartmentNotice_createdAt_idx" ON "DepartmentNotice"("createdAt" DESC)`,

      `CREATE TABLE IF NOT EXISTS "NoticeReadStatus" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "noticeId" TEXT NOT NULL,
        "userId" UUID NOT NULL,
        "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "NoticeReadStatus_notice_user_unique" UNIQUE ("noticeId", "userId")
      )`,
      `CREATE INDEX IF NOT EXISTS "NoticeReadStatus_userId_idx" ON "NoticeReadStatus"("userId")`
    ];

    for (const sql of ddlStatements) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (err: any) {
        console.warn(`DDL execute notice: ${err?.message || err}`);
      }
    }

    // 7. Seed initial seafood items if table is empty
    const count: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "SeafoodItem"`);
    if (count && count[0] && count[0].count === 0) {
      const defaultItems = [
        { name: 'Tiger Prawns (Large)', category: 'Prawns', unit: 'kg', price: 2800, desc: 'Fresh deep sea jumbo tiger prawns, ideal for BBQ & curry.' },
        { name: 'Yellowfin Tuna (Kelawalla)', category: 'Fish', unit: 'kg', price: 2200, desc: 'Premium sashimi grade yellowfin tuna fillet cut.' },
        { name: 'Atlantic Salmon Fillet', category: 'Fish', unit: 'kg', price: 4600, desc: 'Imported fresh Atlantic pink salmon portions.' },
        { name: 'Cuttlefish (Cleaned)', category: 'Cuttlefish', unit: 'kg', price: 1850, desc: 'Peeled, cleaned cuttlefish rings ready to cook.' },
        { name: 'Mud Crab (Grade A)', category: 'Crab', unit: 'kg', price: 3400, desc: 'Live succulent mud crabs with full meat claws.' },
        { name: 'Sailfish (Thalapath)', category: 'Fish', unit: 'kg', price: 2500, desc: 'Firm, boneless Thalapath steak slices.' },
        { name: 'White Prawns (Medium)', category: 'Prawns', unit: 'kg', price: 1950, desc: 'Sweet ocean white prawns, perfect for devilled & pasta.' },
        { name: 'Barramundi (Modha Fillet)', category: 'Fish', unit: 'kg', price: 2100, desc: 'Clean white meat modha fillets with rich flavor.' },
      ];

      for (const item of defaultItems) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "SeafoodItem" ("id", "name", "category", "unit", "unitPrice", "description", "inStock", "createdAt", "updatedAt")
          VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT ("name") DO NOTHING
        `, item.name, item.category, item.unit, item.price, item.desc);
      }
    }

    // 8. Automatically sync existing Department Heads to SECTIONAL_HEAD role
    try {
      const deptsWithHead = await prisma.department.findMany({
        where: { headId: { not: null } },
        select: { headId: true, name: true, id: true }
      });
      for (const d of deptsWithHead) {
        if (d.headId) {
          await prisma.user.updateMany({
            where: { id: d.headId, role: { notIn: ['SUPER_ADMIN', 'ADMIN'] } },
            data: { 
              role: 'SECTIONAL_HEAD' as any, 
              position: 'Sectional Head',
              department: d.name,
              departmentId: d.id,
            }
          });
        }
      }
    } catch (e) {
      // Ignore if column/enum is in transient state
    }
    isEnsured = true;
  } catch (err: any) {
    console.error('Error in ensureSectionalHeadAndNewTables:', err?.message || err);
  } finally {
    isEnsuringPromise = null;
  }
})();

  return isEnsuringPromise;
}

// ==========================================
// SECTIONAL HEAD RESOLVER & PERMISSION HELPERS
// ==========================================

export async function getSectionalHeadContext(userId: string) {
  await ensureSectionalHeadAndNewTables();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      department: true,
      departmentId: true,
      position: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });

  if (!user) return null;

  // Check if user is the assigned head of any department
  const managedDepartment = await prisma.department.findFirst({
    where: { headId: userId },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });

  const isSectionalHead = (user.role as string) === 'SECTIONAL_HEAD' || !!managedDepartment;
  const isSuperAdminOrHR = user.role === 'SUPER_ADMIN' || (user.department && user.department.toUpperCase() === 'HR');
  const isGlobalAdmin = user.role === 'ADMIN' || isSuperAdminOrHR;

  return {
    user,
    managedDepartment,
    isSectionalHead,
    isGlobalAdmin,
    isSuperAdminOrHR,
    departmentId: managedDepartment ? managedDepartment.id : user.departmentId,
  };
}
