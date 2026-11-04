import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

// Helper function to escape SQL strings
function escapeSQLString(str: string | null | undefined): string {
  if (str === null || str === undefined) return 'NULL';
  return `'${str.replace(/'/g, "''")}'`;
}

// Helper function to format SQL values
function formatSQLValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return value.toString();
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (Array.isArray(value)) return `ARRAY[${value.map(v => escapeSQLString(v)).join(', ')}]`;
  if (typeof value === 'object') return escapeSQLString(JSON.stringify(value));
  return escapeSQLString(value.toString());
}

// Helper function to generate INSERT statements
function generateInsertStatements(tableName: string, records: any[]): string {
  if (records.length === 0) return `-- No data for ${tableName}\n`;

  let sql = `-- Data for ${tableName} (${records.length} records)\n`;

  records.forEach((record) => {
    const columns = Object.keys(record).filter(key =>
      !['_count', 'password'].includes(key) &&
      typeof record[key] !== 'object' ||
      record[key] instanceof Date ||
      Array.isArray(record[key])
    );

    const columnNames = columns.join(', ');
    const values = columns.map(col => formatSQLValue(record[col])).join(', ');

    sql += `INSERT INTO "${tableName}" (${columnNames}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
  });

  return sql + '\n';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the user from the request
    const supabase = createClient(req, res);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if the user is an admin
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!userData || ((userData.role as any) !== 'ADMIN' && (userData.role as any) !== 'SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    // Fetch all data from the database (without nested relations for SQL export)
    const [
      users,
      locations,
      attendances,
      leaveTypes,
      leaveRequests,
      leaveBalances,
      leaveDocuments,
      workShifts,
      rosters,
      notificationSubscriptions,
      notifications,
      dailyReports,
      tasks,
      taskMessages,
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.location.findMany(),
      prisma.attendance.findMany(),
      prisma.leaveType.findMany(),
      prisma.leaveRequest.findMany(),
      prisma.leaveBalance.findMany(),
      prisma.leaveDocument.findMany(),
      prisma.workShift.findMany(),
      prisma.roster.findMany(),
      prisma.notificationSubscription.findMany(),
      prisma.notification.findMany(),
      prisma.dailyReport.findMany(),
      prisma.task.findMany(),
      prisma.taskMessage.findMany(),
    ]);

    // Generate SQL backup
    let sqlBackup = `-- Database Backup
-- Generated: ${new Date().toISOString()}
-- Database: PostgreSQL
-- Total Records: ${users.length + locations.length + attendances.length +
      leaveTypes.length + leaveRequests.length + leaveBalances.length +
      leaveDocuments.length + workShifts.length + rosters.length +
      notificationSubscriptions.length + notifications.length +
      dailyReports.length + tasks.length + taskMessages.length
      }

BEGIN;

-- Disable triggers for faster inserts
SET session_replication_role = replica;

`;

    // Add table-specific data in the correct order (respecting foreign keys)
    sqlBackup += generateInsertStatements('User', users);
    sqlBackup += generateInsertStatements('Location', locations);
    sqlBackup += generateInsertStatements('LeaveType', leaveTypes);
    sqlBackup += generateInsertStatements('WorkShift', workShifts);
    sqlBackup += generateInsertStatements('Attendance', attendances);
    sqlBackup += generateInsertStatements('LeaveBalance', leaveBalances);
    sqlBackup += generateInsertStatements('LeaveRequest', leaveRequests);
    sqlBackup += generateInsertStatements('LeaveDocument', leaveDocuments);
    sqlBackup += generateInsertStatements('Roster', rosters);
    sqlBackup += generateInsertStatements('NotificationSubscription', notificationSubscriptions);
    sqlBackup += generateInsertStatements('Notification', notifications);
    sqlBackup += generateInsertStatements('DailyReport', dailyReports);
    sqlBackup += generateInsertStatements('Task', tasks);
    sqlBackup += generateInsertStatements('TaskMessage', taskMessages);

    sqlBackup += `
-- Re-enable triggers
SET session_replication_role = DEFAULT;

COMMIT;

-- Backup completed successfully
`;

    // Return SQL file
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=database_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.sql`
    );
    return res.status(200).send(sqlBackup);
  } catch (error) {
    console.error('SQL backup error:', error);
    return res.status(500).json({
      error: 'Failed to create SQL backup',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
