import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import PDFDocument from 'pdfkit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Create Supabase client
  const supabase = createClient(req, res);

  // Get the user from the session
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get user with role from database
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true }
  });

  if (!dbUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Only admins and managers can generate reports
  if (dbUser.role !== 'ADMIN' && dbUser.role !== 'MANAGER' && (dbUser.role as any) !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Only admins, managers and super admins can generate reports' });
  }

  try {
    const { employeeId, status, startDate, endDate } = req.body;

    // Build the query
    let whereClause: any = {};

    if (employeeId) {
      whereClause.assignedToId = employeeId;
    }

    if (status) {
      whereClause.status = status;
    }

    // Date range filter safely
    if (startDate && endDate) {
      const parsedStart = new Date(startDate);
      const parsedEnd = new Date(endDate);

      if (!isNaN(parsedStart.getTime()) && !isNaN(parsedEnd.getTime())) {
        whereClause.createdAt = {
          gte: parsedStart,
          lte: parsedEnd,
        };
      }
    }

    // Get tasks based on filters
    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { assignedToId: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Group tasks by employee
    const tasksByEmployee: Record<string, any[]> = {};

    tasks.forEach(task => {
      const employeeId = task.assignedToId;
      const employeeName = `${task.assignedTo.firstName || ''} ${task.assignedTo.lastName || ''}`.trim() || task.assignedTo.email;

      if (!tasksByEmployee[employeeId]) {
        tasksByEmployee[employeeId] = [];
      }

      tasksByEmployee[employeeId].push({
        ...task,
        employeeName,
      });
    });

    // Create a PDF document
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=task-report-${new Date().toISOString().split('T')[0]}.pdf`);

    // Pipe the PDF to the response
    doc.pipe(res);

    // Add title
    doc.fontSize(20).text('Employee Task Report', { align: 'center' });
    doc.moveDown();

    // Add report period
    if (startDate && endDate) {
      doc.fontSize(12).text(`Report Period: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`, { align: 'center' });
      doc.moveDown();
    }

    // Add report generation date
    doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    // Add summary statistics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED' || t.status === 'APPROVED').length;
    const rejectedTasks = tasks.filter(t => t.status === 'REJECTED').length;
    const pendingTasks = tasks.filter(t => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS').length;

    doc.fontSize(14).text('Summary Statistics', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Total Tasks: ${totalTasks}`);
    doc.fontSize(12).text(`Completed/Approved Tasks: ${completedTasks}`);
    doc.fontSize(12).text(`Rejected Tasks: ${rejectedTasks}`);
    doc.fontSize(12).text(`Pending Tasks: ${pendingTasks}`);
    doc.moveDown(2);

    // Add employee-wise breakdown
    doc.fontSize(14).text('Employee-wise Task Breakdown', { underline: true });
    doc.moveDown();

    // For each employee
    Object.entries(tasksByEmployee).forEach(([employeeId, employeeTasks], index) => {
      if (index > 0) {
        doc.addPage();
      }

      const employeeName = employeeTasks[0].employeeName;

      // Employee header
      doc.fontSize(16).text(`Employee: ${employeeName}`, { underline: true });
      doc.moveDown();

      // Employee statistics
      const totalEmployeeTasks = employeeTasks.length;
      const completedEmployeeTasks = employeeTasks.filter(t => t.status === 'COMPLETED' || t.status === 'APPROVED').length;
      const rejectedEmployeeTasks = employeeTasks.filter(t => t.status === 'REJECTED').length;
      const pendingEmployeeTasks = employeeTasks.filter(t => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS').length;

      doc.fontSize(12).text(`Total Tasks: ${totalEmployeeTasks}`);
      doc.fontSize(12).text(`Completed/Approved Tasks: ${completedEmployeeTasks}`);
      doc.fontSize(12).text(`Rejected Tasks: ${rejectedEmployeeTasks}`);
      doc.fontSize(12).text(`Pending Tasks: ${pendingEmployeeTasks}`);
      doc.moveDown();

      // Task details table
      doc.fontSize(14).text('Task Details', { underline: true });
      doc.moveDown();

      // Table headers
      const tableTop = doc.y;
      const tableLeft = 50;
      const colWidths = [150, 100, 100, 100];

      doc.fontSize(10).text('Task Title', tableLeft, tableTop);
      doc.text('Status', tableLeft + colWidths[0], tableTop);
      doc.text('Deadline', tableLeft + colWidths[0] + colWidths[1], tableTop);
      doc.text('Duration', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], tableTop);

      doc.moveTo(tableLeft, tableTop + 15)
        .lineTo(tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTop + 15)
        .stroke();

      let rowTop = tableTop + 20;

      // Table rows
      employeeTasks.forEach((task, i) => {
        // Check if we need a new page
        if (rowTop > doc.page.height - 100) {
          doc.addPage();
          rowTop = 50;

          // Repeat headers on new page
          doc.fontSize(10).text('Task Title', tableLeft, rowTop);
          doc.text('Status', tableLeft + colWidths[0], rowTop);
          doc.text('Deadline', tableLeft + colWidths[0] + colWidths[1], rowTop);
          doc.text('Duration', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], rowTop);

          doc.moveTo(tableLeft, rowTop + 15)
            .lineTo(tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rowTop + 15)
            .stroke();

          rowTop += 20;
        }

        // Format duration in hours and minutes
        const durationHours = Math.floor(task.duration / 60);
        const durationMinutes = task.duration % 60;
        const formattedDuration = `${durationHours}h ${durationMinutes}m`;

        doc.fontSize(9).text(task.title, tableLeft, rowTop, { width: colWidths[0] - 10 });
        doc.text(task.status, tableLeft + colWidths[0], rowTop);
        doc.text(new Date(task.deadline).toLocaleDateString(), tableLeft + colWidths[0] + colWidths[1], rowTop);
        doc.text(formattedDuration, tableLeft + colWidths[0] + colWidths[1] + colWidths[2], rowTop);

        rowTop += 20;
      });
    });

    // Finalize the PDF
    doc.end();

  } catch (error) {
    console.error('Error generating task report:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}