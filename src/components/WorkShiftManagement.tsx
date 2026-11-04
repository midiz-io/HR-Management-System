import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaSpinner, 
  FaClock, 
  FaCalendarDay, 
  FaUsers,
  FaExclamationTriangle,
  FaUserMinus,
  FaInfoCircle
} from 'react-icons/fa';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface WorkShift {
  id: string;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string;
  days: string[];
  employees: User[];
  createdAt: string;
  updatedAt: string;
}

const daysOfWeek = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

const WorkShiftManagement: React.FC = () => {
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState<boolean>(false);
  const [showRemoveEmployeesDialog, setShowRemoveEmployeesDialog] = useState<boolean>(false);
  const [selectedWorkShift, setSelectedWorkShift] = useState<WorkShift | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [deleteAllLoading, setDeleteAllLoading] = useState<boolean>(false);
  const [removeEmployeesLoading, setRemoveEmployeesLoading] = useState<boolean>(false);
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  
  const { toast } = useToast();

  // Fetch work shifts and users on component mount
  useEffect(() => {
    fetchWorkShifts();
    fetchUsers();
  }, []);

  // Fetch work shifts from API
  const fetchWorkShifts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/work-shifts');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch work shifts');
      }
      
      const data = await response.json();
      setWorkShifts(data);
    } catch (error: any) {
      console.error('Error fetching work shifts:', error);
      setError(error.message || 'Failed to fetch work shifts');
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to fetch work shifts',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch users from API
  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch users');
      }
      
      const data = await response.json();
      setUsers(data);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to fetch users',
      });
    }
  };

  // Handle form submission for creating/editing work shift
  const handleSubmit = async () => {
    try {
      setSubmitLoading(true);
      setError(null);
      
      // Validate form
      if (!name || !startTime || !endTime || selectedDays.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: 'Please fill in all required fields',
        });
        return;
      }

      const workShiftData = {
        name,
        description,
        startTime,
        endTime,
        days: selectedDays,
        employeeIds: selectedEmployees,
      };

      let response;
      
      if (isEditing && selectedWorkShift) {
        // Update existing work shift
        response = await fetch(`/api/work-shifts/${selectedWorkShift.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(workShiftData),
        });
      } else {
        // Create new work shift
        response = await fetch('/api/work-shifts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(workShiftData),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save work shift');
      }

      toast({
        title: 'Success',
        description: isEditing ? 'Work shift updated successfully' : 'Work shift created successfully',
      });

      // Reset form and refresh data
      resetForm();
      fetchWorkShifts();
    } catch (error: any) {
      console.error('Error saving work shift:', error);
      setError(error.message || 'Failed to save work shift');
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save work shift',
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  // Handle delete work shift
  const handleDelete = async () => {
    if (!selectedWorkShift) return;
    
    try {
      setDeleteLoading(true);
      setError(null);
      
      // Delete the work shift
      const response = await fetch(`/api/work-shifts/${selectedWorkShift.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete work shift');
      }

      toast({
        title: 'Success',
        description: 'Work shift deleted successfully',
      });

      // Close dialog and refresh data
      setShowDeleteDialog(false);
      setSelectedWorkShift(null);
      fetchWorkShifts();
    } catch (error: any) {
      console.error('Error deleting work shift:', error);
      setError(error.message || 'Failed to delete work shift');
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete work shift',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle delete all work shifts
  const handleDeleteAll = async () => {
    try {
      setDeleteAllLoading(true);
      setError(null);
      
      // Call the delete-all API endpoint
      const response = await fetch('/api/work-shifts/delete-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete all work shifts');
      }

      const data = await response.json();

      toast({
        title: 'Success',
        description: `Successfully deleted ${data.deletedCount || 'all'} work shifts`,
      });

      // Close dialog and refresh data
      setShowDeleteAllDialog(false);
      fetchWorkShifts();
    } catch (error: any) {
      console.error('Error deleting all work shifts:', error);
      setError(error.message || 'Failed to delete all work shifts');
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete all work shifts',
      });
    } finally {
      setDeleteAllLoading(false);
    }
  };

  // Handle remove all employees from work shift
  const handleRemoveEmployees = async () => {
    if (!selectedWorkShift) return;
    
    try {
      setRemoveEmployeesLoading(true);
      setError(null);
      
      // Call the remove-employees API endpoint
      const response = await fetch('/api/work-shifts/remove-employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workShiftId: selectedWorkShift.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove employees from work shift');
      }

      const data = await response.json();

      toast({
        title: 'Success',
        description: `Successfully removed ${data.removedCount} employees from work shift`,
      });

      // Close dialog and refresh data
      setShowRemoveEmployeesDialog(false);
      setSelectedWorkShift(null);
      fetchWorkShifts();
    } catch (error: any) {
      console.error('Error removing employees from work shift:', error);
      setError(error.message || 'Failed to remove employees from work shift');
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to remove employees from work shift',
      });
    } finally {
      setRemoveEmployeesLoading(false);
    }
  };

  // Reset form state
  const resetForm = () => {
    setName('');
    setDescription('');
    setStartTime('09:00');
    setEndTime('17:00');
    setSelectedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    setSelectedEmployees([]);
    setIsCreating(false);
    setIsEditing(false);
    setSelectedWorkShift(null);
    setError(null);
  };

  // Set form values for editing
  const prepareEdit = (workShift: WorkShift) => {
    setSelectedWorkShift(workShift);
    setName(workShift.name);
    setDescription(workShift.description || '');
    setStartTime(workShift.startTime);
    setEndTime(workShift.endTime);
    setSelectedDays(workShift.days);
    setSelectedEmployees(workShift.employees.map(emp => emp.id));
    setIsEditing(true);
    setIsCreating(true);
    setError(null);
  };

  // Format time for display
  const formatTime = (timeString: string) => {
    try {
      const [hours, minutes] = timeString.split(':');
      const date = new Date();
      date.setHours(parseInt(hours, 10));
      date.setMinutes(parseInt(minutes, 10));
      return format(date, 'h:mm a');
    } catch (error) {
      return timeString; // Fallback to original string if parsing fails
    }
  };

  // Get employee name
  const getEmployeeName = (employee: User) => {
    return employee.firstName && employee.lastName 
      ? `${employee.firstName} ${employee.lastName}` 
      : employee.email;
  };

  // Format days for display
  const formatDays = (days: string[]) => {
    if (days.length === 7) {
      return 'All days';
    } else if (days.length === 5 && 
               days.includes('Monday') && 
               days.includes('Tuesday') && 
               days.includes('Wednesday') && 
               days.includes('Thursday') && 
               days.includes('Friday')) {
      return 'Weekdays';
    } else if (days.length === 2 && 
               days.includes('Saturday') && 
               days.includes('Sunday')) {
      return 'Weekends';
    } else {
      return days.join(', ');
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/15 border border-destructive rounded-md p-4 mb-4">
          <div className="flex items-start">
            <FaExclamationTriangle className="text-destructive mt-0.5 mr-3 h-5 w-5" />
            <div>
              <h3 className="text-sm font-medium text-destructive">Error</h3>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-2">
          <div>
            <CardTitle>Work Shift Management</CardTitle>
            <CardDescription>
              Create and manage employee work shifts
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => setIsCreating(true)} className="w-full sm:w-auto">
              <FaPlus className="mr-2 h-4 w-4" />
              New Work Shift
            </Button>
            {workShifts.length > 0 && (
              <Button 
                variant="destructive" 
                onClick={() => setShowDeleteAllDialog(true)} 
                className="w-full sm:w-auto"
              >
                <FaTrash className="mr-2 h-4 w-4" />
                Delete All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <FaSpinner className="animate-spin h-8 w-8 text-primary" />
            </div>
          ) : workShifts.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Schedule</TableHead>
                      <TableHead className="hidden md:table-cell">Days</TableHead>
                      <TableHead className="hidden md:table-cell">Employees</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workShifts.map((workShift) => (
                      <TableRow key={workShift.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{workShift.name}</span>
                            {workShift.description && (
                              <span className="text-xs text-muted-foreground">
                                {workShift.description}
                              </span>
                            )}
                            <div className="sm:hidden text-xs text-muted-foreground mt-1">
                              <div className="flex items-center">
                                <FaClock className="mr-1 h-3 w-3" />
                                {formatTime(workShift.startTime)} - {formatTime(workShift.endTime)}
                              </div>
                              <div className="flex items-center mt-1">
                                <FaUsers className="mr-1 h-3 w-3" />
                                {workShift.employees.length} assigned
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center">
                            <FaClock className="mr-2 h-3 w-3 text-muted-foreground" />
                            {formatTime(workShift.startTime)} - {formatTime(workShift.endTime)}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center">
                            <FaCalendarDay className="mr-2 h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {formatDays(workShift.days)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center">
                            <FaUsers className="mr-2 h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {workShift.employees.length} assigned
                            </span>
                            {workShift.employees.length > 0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 ml-1">
                                      <FaInfoCircle className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="max-w-xs">
                                      <p className="font-medium mb-1">Assigned Employees:</p>
                                      <ul className="text-xs space-y-1">
                                        {workShift.employees.map(emp => (
                                          <li key={emp.id}>{getEmployeeName(emp)}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => prepareEdit(workShift)}
                              title="Edit work shift"
                            >
                              <FaEdit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            {workShift.employees.length > 0 && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedWorkShift(workShift);
                                  setShowRemoveEmployeesDialog(true);
                                }}
                                title="Remove all employees"
                              >
                                <FaUserMinus className="h-4 w-4" />
                                <span className="sr-only">Remove employees</span>
                              </Button>
                            )}
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => {
                                setSelectedWorkShift(workShift);
                                setShowDeleteDialog(true);
                              }}
                              title="Delete work shift"
                            >
                              <FaTrash className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FaInfoCircle className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>No work shifts found. Click "New Work Shift" to create one.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Work Shift Dialog */}
      <Dialog open={isCreating} onOpenChange={(open) => {
        if (!open) resetForm();
        setIsCreating(open);
      }}>
        <DialogContent className="w-[95vw] max-w-md max-h-[95vh] flex flex-col sm:max-w-md p-0">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
            <DialogTitle className="text-lg sm:text-xl">{isEditing ? 'Edit Work Shift' : 'Create New Work Shift'}</DialogTitle>
            <DialogDescription className="text-sm">
              {isEditing 
                ? 'Update the details of the selected work shift' 
                : 'Define a new work shift schedule for your employees'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6">
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Shift Name *</Label>
                <Input 
                  id="name" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g., Morning Shift"
                  className="h-10 sm:h-11 text-sm"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Textarea 
                  id="description" 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  placeholder="Optional description of this shift"
                  className="min-h-[80px] text-sm resize-none"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime" className="text-sm font-medium">Start Time *</Label>
                  <Input 
                    id="startTime" 
                    type="time" 
                    value={startTime} 
                    onChange={(e) => setStartTime(e.target.value)}
                    className="h-10 sm:h-11 text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="endTime" className="text-sm font-medium">End Time *</Label>
                  <Input 
                    id="endTime" 
                    type="time" 
                    value={endTime} 
                    onChange={(e) => setEndTime(e.target.value)}
                    className="h-10 sm:h-11 text-sm"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Working Days *</Label>
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                  {daysOfWeek.map((day) => (
                    <div key={day} className="flex items-center space-x-2 min-h-[40px]">
                      <Checkbox 
                        id={`day-${day}`} 
                        checked={selectedDays.includes(day)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedDays([...selectedDays, day]);
                          } else {
                            setSelectedDays(selectedDays.filter(d => d !== day));
                          }
                        }}
                        className="h-4 w-4"
                      />
                      <Label 
                        htmlFor={`day-${day}`} 
                        className="cursor-pointer text-sm font-normal flex-1"
                      >
                        {day}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label className="text-sm font-medium">Assign Employees</Label>
                  <Badge variant="outline" className="text-xs">
                    {selectedEmployees.length} selected
                  </Badge>
                </div>
                <div className="max-h-40 sm:max-h-48 overflow-y-auto border rounded-md p-2 sm:p-3">
                  {users.length > 0 ? (
                    <div className="space-y-1">
                      {users.map((user) => (
                        <div key={user.id} className="flex items-center space-x-2 py-1.5 min-h-[40px]">
                          <Checkbox 
                            id={`user-${user.id}`} 
                            checked={selectedEmployees.includes(user.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedEmployees([...selectedEmployees, user.id]);
                              } else {
                                setSelectedEmployees(selectedEmployees.filter(id => id !== user.id));
                              }
                            }}
                            className="h-4 w-4 flex-shrink-0"
                          />
                          <Label 
                            htmlFor={`user-${user.id}`} 
                            className="cursor-pointer text-sm flex-1"
                          >
                            {getEmployeeName(user)}
                          </Label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No employees found
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="px-6 pb-6 pt-4 flex-shrink-0 flex-col sm:flex-row gap-2 sm:gap-0 border-t">
            <Button 
              variant="outline" 
              onClick={resetForm} 
              disabled={submitLoading}
              className="w-full sm:w-auto order-2 sm:order-1 h-10 sm:h-11"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={submitLoading}
              className="w-full sm:w-auto order-1 sm:order-2 h-10 sm:h-11"
            >
              {submitLoading ? (
                <>
                  <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                  <span className="text-sm">{isEditing ? 'Updating...' : 'Creating...'}</span>
                </>
              ) : (
                <span className="text-sm">{isEditing ? 'Update Work Shift' : 'Create Work Shift'}</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FaExclamationTriangle className="text-destructive" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this work shift? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {selectedWorkShift && (
            <div className="py-4">
              <p className="font-medium">{selectedWorkShift.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatTime(selectedWorkShift.startTime)} - {formatTime(selectedWorkShift.endTime)}, 
                {formatDays(selectedWorkShift.days)}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {selectedWorkShift.employees.length} employees assigned to this shift
              </p>
              
              {selectedWorkShift.employees.length > 0 && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Warning:</p>
                  <p className="text-sm mt-1 text-amber-700 dark:text-amber-500">
                    This will remove all employee assignments to this shift.
                  </p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleteLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? (
                <>
                  <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Work Shift'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <Dialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FaExclamationTriangle className="text-destructive" />
              Delete All Work Shifts
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete ALL work shifts? This action cannot be undone and will remove all {workShifts.length} work shifts.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="p-3 bg-destructive/10 rounded-md border border-destructive/20">
              <p className="text-sm font-medium text-destructive">Warning:</p>
              <ul className="text-sm mt-2 list-disc pl-5 space-y-1">
                <li>All employee assignments to these shifts will be removed</li>
                <li>Any rosters using these shifts will be deleted</li>
                <li>This action is permanent and cannot be reversed</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteAllDialog(false)} disabled={deleteAllLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteAll} disabled={deleteAllLoading}>
              {deleteAllLoading ? (
                <>
                  <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                  Deleting All...
                </>
              ) : (
                'Delete All Work Shifts'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Employees Confirmation Dialog */}
      <Dialog open={showRemoveEmployeesDialog} onOpenChange={setShowRemoveEmployeesDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FaUserMinus className="text-amber-500" />
              Remove All Employees
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove all employees from this work shift?
            </DialogDescription>
          </DialogHeader>
          
          {selectedWorkShift && (
            <div className="py-4">
              <p className="font-medium">{selectedWorkShift.name}</p>
              <p className="text-sm text-muted-foreground">
                Currently has {selectedWorkShift.employees.length} assigned employees
              </p>
              
              <div className="mt-4 max-h-32 overflow-y-auto">
                <p className="text-sm font-medium mb-1">Assigned employees:</p>
                <ul className="text-sm space-y-1 pl-5 list-disc">
                  {selectedWorkShift.employees.map(emp => (
                    <li key={emp.id}>{getEmployeeName(emp)}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveEmployeesDialog(false)} disabled={removeEmployeesLoading}>Cancel</Button>
            <Button variant="default" onClick={handleRemoveEmployees} disabled={removeEmployeesLoading}>
              {removeEmployeesLoading ? (
                <>
                  <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove All Employees'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkShiftManagement;