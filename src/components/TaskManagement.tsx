import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { 
  CalendarIcon, 
  CheckIcon, 
  XIcon, 
  ClockIcon, 
  FileTextIcon, 
  DownloadIcon, 
  Share2Icon,
  MessageSquareIcon,
  SendIcon,
  UserIcon,
  ExternalLink,
  Search,
  Repeat
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useRealtimeSubscription } from '@/contexts/RealtimeContext';

interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role?: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  assignedToId: string;
  assignedById: string;
  assignedTo: User;
  assignedBy?: User;
  startDate: string;
  deadline: string;
  duration: number;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED';
  proofImageUrl?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskMessage {
  id: string;
  taskId: string;
  userId: string;
  user: User;
  message: string;
  createdAt: string;
}

export default function TaskManagement() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('ALL_EMPLOYEES');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isChatDialogOpen, setIsChatDialogOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [taskStats, setTaskStats] = useState({
    total: 0,
    assigned: 0,
    inProgress: 0,
    completed: 0,
    approved: 0,
    rejected: 0
  });
  
  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [assignToAll, setAssignToAll] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [deadline, setDeadline] = useState<Date | undefined>(new Date());
  const [durationHours, setDurationHours] = useState('1');
  const [durationMinutes, setDurationMinutes] = useState('0');
  const [repeatSchedule, setRepeatSchedule] = useState<'NONE' | 'DAILY' | 'WEEKDAYS' | 'WEEKLY'>('NONE');
  const [employeeSearchText, setEmployeeSearchText] = useState('');
  const [filterEmployeeSearchText, setFilterEmployeeSearchText] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Report states
  const [reportEmployeeId, setReportEmployeeId] = useState('ALL_EMPLOYEES');
  const [reportStatus, setReportStatus] = useState('ALL');
  const [reportStartDate, setReportStartDate] = useState<Date | undefined>(
    new Date(new Date().setDate(new Date().getDate() - 30))
  );
  const [reportEndDate, setReportEndDate] = useState<Date | undefined>(new Date());

  // Fetch tasks and employees on component mount
  useEffect(() => {
    fetchTasks();
    fetchEmployees();
  }, []);

  // Real-time task updates subscription
  useRealtimeSubscription('TASK_UPDATED', () => {
    fetchTasks(selectedEmployee, selectedStatus);
  });

  // Real-time chat message subscription
  useRealtimeSubscription('CHAT_MESSAGE', (payload) => {
    if (currentTask && payload.data?.taskId === currentTask.id) {
      fetchMessages(currentTask.id);
    }
  });

  // Auto refresh on window focus / heartbeat
  useRealtimeSubscription('REFRESH_ALL', () => {
    fetchTasks(selectedEmployee, selectedStatus);
    if (currentTask && isChatDialogOpen) {
      fetchMessages(currentTask.id);
    }
  });

  // Update task statistics whenever tasks change
  useEffect(() => {
    updateTaskStats();
  }, [tasks]);
  
  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Fetch tasks with optional filters
  const fetchTasks = async (employeeId?: string, status?: string) => {
    setLoading(true);
    try {
      let url = '/api/tasks';
      const params = new URLSearchParams();
      
      if (employeeId) {
        params.append('employeeId', employeeId);
      }
      
      if (status) {
        params.append('status', status);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tasks. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch employees for task assignment
  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/users');
      
      if (!response.ok) {
        throw new Error('Failed to fetch employees');
      }
      
      const data = await response.json();
      setEmployees(data);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        title: 'Error',
        description: 'Failed to load employees. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Update task statistics
  const updateTaskStats = () => {
    const stats = {
      total: tasks.length,
      assigned: tasks.filter(task => task.status === 'ASSIGNED').length,
      inProgress: tasks.filter(task => task.status === 'IN_PROGRESS').length,
      completed: tasks.filter(task => task.status === 'COMPLETED').length,
      approved: tasks.filter(task => task.status === 'APPROVED').length,
      rejected: tasks.filter(task => task.status === 'REJECTED').length
    };
    
    setTaskStats(stats);
  };

  // Handle filter changes
  const handleFilterChange = () => {
    // If status is "ALL", pass undefined to fetch all statuses
    const statusFilter = selectedStatus === "ALL" ? undefined : selectedStatus;
    // If employee is "ALL_EMPLOYEES", pass undefined to fetch all employees
    const employeeFilter = selectedEmployee === "ALL_EMPLOYEES" ? undefined : selectedEmployee;
    fetchTasks(employeeFilter, statusFilter);
  };

  // Reset filters
  const resetFilters = () => {
    setSelectedEmployee('ALL_EMPLOYEES');
    setSelectedStatus('ALL');
    setFilterEmployeeSearchText('');
    fetchTasks();
  };

  // Create a new task
  const createTask = async () => {
    if (!title || !description || (!assigneeId && !assignToAll) || !startDate || !deadline) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }
    
    const totalMinutes = (parseInt(durationHours || '0', 10) * 60) + parseInt(durationMinutes || '0', 10);
    const finalDuration = totalMinutes > 0 ? totalMinutes : 60;
    
    const finalDescription = repeatSchedule !== 'NONE' 
      ? `${description}\n\n[REPEAT:${repeatSchedule}]` 
      : description;

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description: finalDescription,
          assignedToId: assignToAll ? 'ALL_EMPLOYEES' : assigneeId,
          assignToAll,
          startDate: startDate?.toISOString(),
          deadline: deadline?.toISOString(),
          duration: finalDuration,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create task');
      }
      
      // Reset form and close dialog
      setTitle('');
      setDescription('');
      setAssigneeId('');
      setAssignToAll(false);
      setStartDate(new Date());
      setDeadline(new Date());
      setDurationHours('1');
      setDurationMinutes('0');
      setRepeatSchedule('NONE');
      setIsCreateDialogOpen(false);
      
      // Refresh tasks
      fetchTasks();
      
      toast({
        title: 'Success',
        description: assignToAll ? 'Tasks created for all employees.' : 'Task created successfully.',
      });
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to create task. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // View task details
  const viewTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch task details');
      }
      
      const data = await response.json();
      setCurrentTask(data);
      setIsViewDialogOpen(true);
    } catch (error) {
      console.error('Error fetching task details:', error);
      toast({
        title: 'Error',
        description: 'Failed to load task details. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  // Open chat dialog for a task
  const openChatDialog = async (task: Task) => {
    setCurrentTask(task);
    setNewMessage('');
    setIsChatDialogOpen(true);
    
    // Fetch messages for this task
    await fetchMessages(task.id);
  };

  // Fetch messages for a task
  const fetchMessages = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/messages?taskId=${taskId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load messages. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Send a new message
  const sendMessage = async () => {
    if (!currentTask || !newMessage.trim()) return;
    
    try {
      const response = await fetch('/api/tasks/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId: currentTask.id,
          message: newMessage,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      const data = await response.json();
      
      // Add new message to the list
      setMessages([...messages, data]);
      
      // Clear input
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Open review dialog for a task
  const openReviewDialog = (task: Task) => {
    setCurrentTask(task);
    setRejectionReason('');
    setIsReviewDialogOpen(true);
  };

  // Review a completed task
  const reviewTask = async (approved: boolean) => {
    if (!currentTask) return;
    
    if (!approved && !rejectionReason) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a reason for rejection.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const response = await fetch(`/api/tasks/${currentTask.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: approved ? 'APPROVED' : 'REJECTED',
          rejectionReason: approved ? undefined : rejectionReason,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to review task');
      }
      
      // Close dialog and refresh tasks
      setIsReviewDialogOpen(false);
      fetchTasks();
      
      toast({
        title: 'Success',
        description: `Task ${approved ? 'approved' : 'rejected'} successfully.`,
      });
    } catch (error) {
      console.error('Error reviewing task:', error);
      toast({
        title: 'Error',
        description: 'Failed to review task. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Delete a task
  const deleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete task');
      }
      
      // Refresh tasks
      fetchTasks();
      
      toast({
        title: 'Success',
        description: 'Task deleted successfully.',
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete task. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Generate and download task report
  const generateReport = async () => {
    try {
      const response = await fetch('/api/tasks/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: reportEmployeeId === "ALL_EMPLOYEES" ? undefined : reportEmployeeId || undefined,
          status: reportStatus === "ALL" ? undefined : reportStatus || undefined,
          startDate: reportStartDate?.toISOString(),
          endDate: reportEndDate?.toISOString(),
        }),
        responseType: 'blob',
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }
      
      // Create a blob from the PDF stream
      const blob = await response.blob();
      
      // Create a URL for the blob
      const url = URL.createObjectURL(blob);
      
      // Create an HTML wrapper with the PDF and sharing options
      const html = createHtmlWrapperWithPdf(url, {
        startDate: reportStartDate,
        endDate: reportEndDate,
        employeeId: reportEmployeeId,
        status: reportStatus,
        employees: employees
      });
      
      // Open the HTML wrapper in a new tab
      const newTab = window.open('', '_blank');
      if (newTab) {
        newTab.document.write(html);
        newTab.document.close();
      }
      
      // Close the report dialog
      setIsReportDialogOpen(false);
      
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate report. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Create HTML wrapper with PDF and sharing options
  const createHtmlWrapperWithPdf = (pdfUrl: string, reportOptions: any) => {
    // Get employee name if employeeId is provided
    let employeeName = 'All Employees';
    if (reportOptions.employeeId && reportOptions.employeeId !== 'ALL_EMPLOYEES') {
      const employee = employees.find(e => e.id === reportOptions.employeeId);
      if (employee) {
        employeeName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email;
      }
    }
    
    // Format date range
    const dateRange = reportOptions.startDate && reportOptions.endDate
      ? `${format(reportOptions.startDate, 'MMM d, yyyy')} to ${format(reportOptions.endDate, 'MMM d, yyyy')}`
      : 'All time';
    
    // Format status
    const statusText = reportOptions.status === 'ALL' || !reportOptions.status ? 'All statuses' : reportOptions.status;
    
    // Create a summary text for WhatsApp sharing
    const summaryText = encodeURIComponent(
      `*Employee Task Report*\n\n` +
      `*Period:* ${dateRange}\n` +
      `*Employee:* ${employeeName}\n` +
      `*Status:* ${statusText}\n\n` +
      `This report contains task assignments, completion status, and performance metrics for the selected employee(s).`
    );
    
    // Create the HTML wrapper
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Task Report</title>
        <style>
          body, html {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            height: 100%;
            overflow: hidden;
          }
          .header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #f8f9fa;
            padding: 10px 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 1000;
          }
          .title {
            font-size: 18px;
            font-weight: bold;
          }
          .actions {
            display: flex;
            gap: 10px;
          }
          .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 5px;
          }
          .btn-primary {
            background-color: #4f46e5;
            color: white;
          }
          .btn-secondary {
            background-color: #10b981;
            color: white;
          }
          .pdf-container {
            position: absolute;
            top: 60px;
            left: 0;
            right: 0;
            bottom: 0;
            overflow: hidden;
          }
          iframe {
            width: 100%;
            height: 100%;
            border: none;
          }
          .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0,0,0,0.5);
            z-index: 2000;
            justify-content: center;
            align-items: center;
          }
          .modal-content {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            width: 90%;
            max-width: 500px;
          }
          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
          }
          .modal-title {
            font-size: 18px;
            font-weight: bold;
          }
          .close {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
          }
          .modal-body {
            margin-bottom: 20px;
          }
          .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
          }
          .share-option {
            display: flex;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-bottom: 10px;
            cursor: pointer;
          }
          .share-option:hover {
            background-color: #f0f0f0;
          }
          .share-icon {
            margin-right: 10px;
          }
          .share-text {
            flex: 1;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Employee Task Report</div>
          <div class="actions">
            <button class="btn btn-primary" onclick="downloadPdf()">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Download
            </button>
            <button class="btn btn-secondary" onclick="openShareModal()">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
              Share
            </button>
          </div>
        </div>
        
        <div class="pdf-container">
          <iframe src="${pdfUrl}" type="application/pdf"></iframe>
        </div>
        
        <div id="shareModal" class="modal">
          <div class="modal-content">
            <div class="modal-header">
              <div class="modal-title">Share Report</div>
              <button class="close" onclick="closeShareModal()">&times;</button>
            </div>
            <div class="modal-body">
              <div class="share-option" onclick="shareFullReport()">
                <div class="share-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                </div>
                <div class="share-text">
                  <strong>Share Full Report</strong>
                  <p>Share a link to the complete PDF report</p>
                </div>
              </div>
              <div class="share-option" onclick="shareTextSummary()">
                <div class="share-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                </div>
                <div class="share-text">
                  <strong>Share Text Summary</strong>
                  <p>Share a text summary of the report</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <script>
          // Download the PDF
          function downloadPdf() {
            const link = document.createElement('a');
            link.href = '${pdfUrl}';
            link.download = 'task-report-${format(new Date(), 'yyyy-MM-dd')}.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
          
          // Open the share modal
          function openShareModal() {
            document.getElementById('shareModal').style.display = 'flex';
          }
          
          // Close the share modal
          function closeShareModal() {
            document.getElementById('shareModal').style.display = 'none';
          }
          
          // Share the full report via WhatsApp
          function shareFullReport() {
            const message = 'Please find the Employee Task Report attached: ';
            const whatsappUrl = 'https://wa.me/?text=' + encodeURIComponent(message + window.location.href);
            window.open(whatsappUrl, '_blank');
          }
          
          // Share a text summary via WhatsApp
          function shareTextSummary() {
            const whatsappUrl = 'https://wa.me/?text=${summaryText}';
            window.open(whatsappUrl, '_blank');
          }
          
          // Close modal when clicking outside
          window.onclick = function(event) {
            const modal = document.getElementById('shareModal');
            if (event.target === modal) {
              closeShareModal();
            }
          }
        </script>
      </body>
      </html>
    `;
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ASSIGNED':
        return <Badge variant="outline">Assigned</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="secondary">In Progress</Badge>;
      case 'COMPLETED':
        return <Badge variant="default">Completed</Badge>;
      case 'APPROVED':
        return <Badge variant="success">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Format duration from minutes to hours and minutes
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Task Management</h2>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setIsReportDialogOpen(true)}>
            <FileTextIcon className="mr-2 h-4 w-4" />
            Generate Report
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            Create New Task
          </Button>
        </div>
      </div>

      {/* Task Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 task-stats-grid">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assigned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskStats.assigned}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskStats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskStats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskStats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskStats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter tasks by employee and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 filter-section">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="employee-filter">Employee</Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search employee name or email..."
                    value={filterEmployeeSearchText}
                    onChange={(e) => setFilterEmployeeSearchText(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger id="employee-filter">
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="ALL_EMPLOYEES">All Employees</SelectItem>
                    {employees
                      .filter(emp => {
                        if (!filterEmployeeSearchText) return true;
                        const term = filterEmployeeSearchText.toLowerCase();
                        const name = `${emp.firstName || ''} ${emp.lastName || ''} ${emp.email}`.toLowerCase();
                        return name.includes(term);
                      })
                      .map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.firstName} {employee.lastName} ({employee.email})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="ASSIGNED">Assigned</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={resetFilters}>Reset</Button>
          <Button onClick={handleFilterChange}>Apply Filters</Button>
        </CardFooter>
      </Card>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>
            Manage and review employee tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <p>Loading tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex justify-center items-center h-40">
              <p>No tasks found. Create a new task to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="font-bold">{task.title}</span>
                        {task.description.includes('[REPEAT:') && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-semibold mt-0.5">
                            <Repeat className="h-3 w-3" /> Recurring Task
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {task.assignedTo ? `${task.assignedTo.firstName || ''} ${task.assignedTo.lastName || ''}`.trim() || task.assignedTo.email : 'N/A'}
                    </TableCell>
                    <TableCell>{new Date(task.deadline).toLocaleDateString()}</TableCell>
                    <TableCell>{formatDuration(task.duration)}</TableCell>
                    <TableCell>{getStatusBadge(task.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => viewTask(task.id)}>
                          View
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openChatDialog(task)}>
                          <MessageSquareIcon className="h-4 w-4" />
                        </Button>
                        {task.status === 'COMPLETED' && (
                          <Button variant="default" size="sm" onClick={() => openReviewDialog(task)}>
                            Review
                          </Button>
                        )}
                        <Button variant="destructive" size="sm" onClick={() => deleteTask(task.id)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Task Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[650px] dialog-content max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Assign a new task to an employee or all employees. Fill in all details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="title">Task Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter detailed task description"
                rows={3}
              />
            </div>

            {/* Assignee Section with Searchable Dropdown & Assign to All Toggle */}
            <div className="grid gap-2 border p-3.5 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="assignee" className="font-bold">Assign To</Label>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="assign-to-all"
                    checked={assignToAll}
                    onChange={(e) => {
                      setAssignToAll(e.target.checked);
                      if (e.target.checked) setAssigneeId('');
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                  <label htmlFor="assign-to-all" className="text-xs font-bold text-primary cursor-pointer">
                    Assign to ALL Employees ({employees.length})
                  </label>
                </div>
              </div>

              {!assignToAll && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search employee by name or email..."
                      value={employeeSearchText}
                      onChange={(e) => setEmployeeSearchText(e.target.value)}
                      className="pl-9 h-9 text-xs"
                    />
                  </div>
                  <Select value={assigneeId} onValueChange={setAssigneeId}>
                    <SelectTrigger id="assignee">
                      <SelectValue placeholder="Select an employee..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {employees
                        .filter(emp => {
                          if (!employeeSearchText) return true;
                          const term = employeeSearchText.toLowerCase();
                          const name = `${emp.firstName || ''} ${emp.lastName || ''} ${emp.email}`.toLowerCase();
                          return name.includes(term);
                        })
                        .map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.firstName} {employee.lastName} ({employee.email})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="deadline">Deadline</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {deadline ? format(deadline, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={deadline}
                      onSelect={setDeadline}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Duration Section in Hours and Minutes */}
            <div className="grid gap-2 border p-3.5 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
              <Label className="font-bold flex items-center gap-2">
                <ClockIcon className="h-4 w-4 text-primary" />
                Task Duration (Hours & Minutes)
              </Label>
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Hours</span>
                  <Input
                    type="number"
                    min="0"
                    max="72"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Minutes</span>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="text-[10px] font-bold text-muted-foreground mr-1">Presets:</span>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => { setDurationHours('0'); setDurationMinutes('30'); }}>30m</Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => { setDurationHours('1'); setDurationMinutes('0'); }}>1h</Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => { setDurationHours('2'); setDurationMinutes('0'); }}>2h</Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => { setDurationHours('4'); setDurationMinutes('0'); }}>4h</Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => { setDurationHours('8'); setDurationMinutes('0'); }}>8h</Button>
              </div>
            </div>

            {/* Repeat / Recurring Schedule Selector */}
            <div className="grid gap-2">
              <Label htmlFor="repeat-schedule" className="font-bold flex items-center gap-2">
                <Repeat className="h-4 w-4 text-amber-500" />
                Repeat Schedule / Daily Highlight
              </Label>
              <Select value={repeatSchedule} onValueChange={(val: any) => setRepeatSchedule(val)}>
                <SelectTrigger id="repeat-schedule">
                  <SelectValue placeholder="Select repeat option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No Repeat (One-time Task)</SelectItem>
                  <SelectItem value="DAILY">Daily (Repeats Every Day)</SelectItem>
                  <SelectItem value="WEEKDAYS">Weekdays (Mon - Fri)</SelectItem>
                  <SelectItem value="WEEKLY">Weekly (Once per week)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createTask}>Create Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Task Dialog */}
      {currentTask && (
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="sm:max-w-[600px] dialog-content">
            <DialogHeader>
              <DialogTitle>{currentTask.title}</DialogTitle>
              <DialogDescription>
                Task details and status
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Status:</span>
                {getStatusBadge(currentTask.status)}
              </div>
              <div>
                <span className="font-semibold">Assigned To:</span>
                <p>{currentTask.assignedTo.firstName} {currentTask.assignedTo.lastName} ({currentTask.assignedTo.email})</p>
              </div>
              <div>
                <span className="font-semibold">Description:</span>
                <p className="mt-1">{currentTask.description}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold">Start Date:</span>
                  <p>{new Date(currentTask.startDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="font-semibold">Deadline:</span>
                  <p>{new Date(currentTask.deadline).toLocaleDateString()}</p>
                </div>
              </div>
              <div>
                <span className="font-semibold">Duration:</span>
                <p>{formatDuration(currentTask.duration)}</p>
              </div>
              {currentTask.proofImageUrl && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Proof of Completion:</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 flex items-center gap-1.5"
                      onClick={() => window.open(currentTask.proofImageUrl, '_blank')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open Image in New Tab
                    </Button>
                  </div>
                  <div className="mt-1 relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-black/5" onClick={() => window.open(currentTask.proofImageUrl, '_blank')}>
                    <img 
                      src={currentTask.proofImageUrl} 
                      alt="Proof of completion" 
                      className="max-w-full h-auto rounded-xl object-contain max-h-[320px] mx-auto hover:opacity-95 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-2">
                      <ExternalLink className="h-4 w-4" /> Click to View Full High-Res Photo
                    </div>
                  </div>
                </div>
              )}
              {currentTask.status === 'REJECTED' && currentTask.rejectionReason && (
                <div>
                  <span className="font-semibold">Rejection Reason:</span>
                  <p className="mt-1 text-red-500">{currentTask.rejectionReason}</p>
                </div>
              )}
              {currentTask.reviewedAt && (
                <div>
                  <span className="font-semibold">Reviewed On:</span>
                  <p>{new Date(currentTask.reviewedAt).toLocaleString()}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Review Task Dialog */}
      {currentTask && (
        <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
          <DialogContent className="sm:max-w-[600px] dialog-content">
            <DialogHeader>
              <DialogTitle>Review Task</DialogTitle>
              <DialogDescription>
                Review the completed task and approve or reject it
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <span className="font-semibold">Task:</span>
                <p>{currentTask.title}</p>
              </div>
              <div>
                <span className="font-semibold">Completed By:</span>
                <p>{currentTask.assignedTo.firstName} {currentTask.assignedTo.lastName}</p>
              </div>
              {currentTask.proofImageUrl && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Proof of Completion:</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 flex items-center gap-1.5"
                      onClick={() => window.open(currentTask.proofImageUrl, '_blank')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open Image in New Tab
                    </Button>
                  </div>
                  <div className="mt-1 relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-black/5" onClick={() => window.open(currentTask.proofImageUrl, '_blank')}>
                    <img 
                      src={currentTask.proofImageUrl} 
                      alt="Proof of completion" 
                      className="max-w-full h-auto rounded-xl object-contain max-h-[320px] mx-auto hover:opacity-95 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-2">
                      <ExternalLink className="h-4 w-4" /> Click to View Full High-Res Photo
                    </div>
                  </div>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="rejection-reason">Rejection Reason (required if rejecting)</Label>
                <Textarea
                  id="rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why the task is being rejected"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter className="flex justify-between">
              <Button variant="destructive" onClick={() => reviewTask(false)}>
                <XIcon className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button variant="default" onClick={() => reviewTask(true)}>
                <CheckIcon className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Chat Dialog */}
      {currentTask && (
        <Dialog open={isChatDialogOpen} onOpenChange={setIsChatDialogOpen}>
          <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Task Chat</DialogTitle>
              <DialogDescription>
                Chat with {currentTask.assignedTo.firstName} {currentTask.assignedTo.lastName} about this task
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="bg-muted/50 p-3 rounded-md mb-4">
                <h4 className="font-semibold">{currentTask.title}</h4>
                <p className="text-sm text-muted-foreground">
                  Status: {currentTask.status}
                </p>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-4" ref={chatScrollRef}>
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <MessageSquareIcon className="mx-auto h-8 w-8 mb-2 opacity-50" />
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div 
                        key={msg.id} 
                        className={`flex ${msg.userId === user?.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex gap-2 max-w-[80%] ${msg.userId === user?.id ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                            {msg.user.firstName?.[0] || msg.user.email[0]}
                          </div>
                          <div>
                            <div className={`rounded-lg px-3 py-2 ${
                              msg.userId === user?.id 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted'
                            }`}>
                              <p className="text-sm">{msg.message}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {' • '}
                              {msg.user.firstName} {msg.user.lastName}
                              {msg.user.role === 'ADMIN' ? ' (Admin)' : ' (Employee)'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Input
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                <SendIcon className="h-4 w-4" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Generate Report Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Generate Task Report</DialogTitle>
            <DialogDescription>
              Generate a comprehensive report of employee tasks
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="report-employee">Employee</Label>
              <Select value={reportEmployeeId} onValueChange={setReportEmployeeId}>
                <SelectTrigger id="report-employee">
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_EMPLOYEES">All Employees</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.firstName} {employee.lastName} ({employee.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="report-status">Status</Label>
              <Select value={reportStatus} onValueChange={setReportStatus}>
                <SelectTrigger id="report-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="ASSIGNED">Assigned</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="report-start-date">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {reportStartDate ? format(reportStartDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={reportStartDate}
                      onSelect={setReportStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="report-end-date">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {reportEndDate ? format(reportEndDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={reportEndDate}
                      onSelect={setReportEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={generateReport}>
              <FileTextIcon className="mr-2 h-4 w-4" />
              Generate Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}