import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaSpinner, 
  FaClock, 
  FaCalendarDay, 
  FaUser,
  FaExclamationTriangle,
  FaCalendarAlt
} from 'react-icons/fa';
import { format, isToday, isYesterday, isThisWeek, isThisMonth, parseISO } from 'date-fns';

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
}

interface Roster {
  id: string;
  userId: string;
  user: User;
  workShiftId: string;
  workShift: WorkShift;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const RosterManagement: React.FC = () => {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const [selectedRoster, setSelectedRoster] = useState<Roster | null>(null);
  
  // Form state
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedWorkShiftId, setSelectedWorkShiftId] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState<string>('');
  
  const { toast } = useToast();

  // Fetch rosters, users, and work shifts on component mount
  useEffect(() => {
    fetchRosters();
    fetchUsers();
    fetchWorkShifts();
  }, []);

  // Fetch rosters from API
  const fetchRosters = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/rosters');
      if (!response.ok) {
        throw new Error('Failed to fetch rosters');
      }
      const data = await response.json();
      setRosters(data);
    } catch (error) {
      console.error('Error fetching rosters:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch rosters',
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
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch users',
      });
    }
  };

  // Fetch work shifts from API
  const fetchWorkShifts = async () => {
    try {
      const response = await fetch('/api/work-shifts');
      if (!response.ok) {
        throw new Error('Failed to fetch work shifts');
      }
      const data = await response.json();
      setWorkShifts(data);
    } catch (error) {
      console.error('Error fetching work shifts:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch work shifts',
      });
    }
  };

  // Handle form submission for creating/editing roster
  const handleSubmit = async () => {
    try {
      // Validate form
      if (!selectedUserId || !selectedWorkShiftId || !startDate) {
        toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: 'Please fill in all required fields',
        });
        return;
      }

      const rosterData = {
        userId: selectedUserId,
        workShiftId: selectedWorkShiftId,
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : null,
        notes,
      };

      let response;
      
      if (isEditing && selectedRoster) {
        // Update existing roster
        response = await fetch(`/api/rosters/${selectedRoster.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(rosterData),
        });
      } else {
        // Create new roster
        response = await fetch('/api/rosters', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(rosterData),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save roster');
      }

      toast({
        title: 'Success',
        description: isEditing ? 'Roster updated successfully' : 'Roster created successfully',
      });

      // Reset form and refresh data
      resetForm();
      fetchRosters();
    } catch (error: any) {
      console.error('Error saving roster:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save roster',
      });
    }
  };

  // Handle delete roster
  const handleDelete = async () => {
    if (!selectedRoster) return;
    
    try {
      const response = await fetch(`/api/rosters/${selectedRoster.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete roster');
      }

      toast({
        title: 'Success',
        description: 'Roster deleted successfully',
      });

      // Close dialog and refresh data
      setShowDeleteDialog(false);
      setSelectedRoster(null);
      fetchRosters();
    } catch (error: any) {
      console.error('Error deleting roster:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete roster',
      });
    }
  };

  // Reset form state
  const resetForm = () => {
    setSelectedUserId('');
    setSelectedWorkShiftId('');
    setStartDate(new Date());
    setEndDate(undefined);
    setNotes('');
    setIsCreating(false);
    setIsEditing(false);
    setSelectedRoster(null);
  };

  // Set form values for editing
  const prepareEdit = (roster: Roster) => {
    setSelectedRoster(roster);
    setSelectedUserId(roster.userId);
    setSelectedWorkShiftId(roster.workShiftId);
    setStartDate(new Date(roster.startDate));
    setEndDate(roster.endDate ? new Date(roster.endDate) : undefined);
    setNotes(roster.notes || '');
    setIsEditing(true);
    setIsCreating(true);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) {
      return 'Today';
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM d, yyyy');
    }
  };

  // Get employee name
  const getEmployeeName = (employee: User) => {
    return employee.firstName && employee.lastName 
      ? `${employee.firstName} ${employee.lastName}` 
      : employee.email;
  };

  // Format time for display
  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10));
    date.setMinutes(parseInt(minutes, 10));
    return format(date, 'h:mm a');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-2">
          <div>
            <CardTitle>Employee Roster Management</CardTitle>
            <CardDescription>
              Assign employees to work shifts and manage their schedules
            </CardDescription>
          </div>
          <Button onClick={() => setIsCreating(true)} className="w-full sm:w-auto">
            <FaPlus className="mr-2 h-4 w-4" />
            New Roster Assignment
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <FaSpinner className="animate-spin h-8 w-8 text-primary" />
            </div>
          ) : rosters.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="hidden sm:table-cell">Work Shift</TableHead>
                      <TableHead className="hidden md:table-cell">Start Date</TableHead>
                      <TableHead className="hidden md:table-cell">End Date</TableHead>
                      <TableHead className="hidden lg:table-cell">Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rosters.map((roster) => (
                      <TableRow key={roster.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <div className="flex items-center">
                              <FaUser className="mr-2 h-3 w-3 text-muted-foreground" />
                              {getEmployeeName(roster.user)}
                            </div>
                            <div className="sm:hidden text-xs text-muted-foreground mt-1">
                              <span>{roster.workShift.name}</span>
                            </div>
                            <div className="md:hidden text-xs text-muted-foreground">
                              {formatDate(roster.startDate)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex flex-col">
                            <span>{roster.workShift.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(roster.workShift.startTime)} - {formatTime(roster.workShift.endTime)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {formatDate(roster.startDate)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {roster.endDate ? formatDate(roster.endDate) : 'Ongoing'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="max-w-xs truncate">
                            {roster.notes || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => prepareEdit(roster)}
                            >
                              <FaEdit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => {
                                setSelectedRoster(roster);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <FaTrash className="h-4 w-4" />
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
              No roster assignments found. Click "New Roster Assignment" to create one.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Roster Dialog */}
      <Dialog open={isCreating} onOpenChange={(open) => {
        if (!open) resetForm();
        setIsCreating(open);
      }}>
        <DialogContent className="w-[95vw] max-w-md max-h-[95vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">{isEditing ? 'Edit Roster Assignment' : 'Create New Roster Assignment'}</DialogTitle>
            <DialogDescription className="text-sm">
              {isEditing 
                ? 'Update the roster assignment details' 
                : 'Assign an employee to a work shift schedule'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="employee" className="text-sm font-medium">Employee *</Label>
              <Select 
                value={selectedUserId} 
                onValueChange={setSelectedUserId}
              >
                <SelectTrigger id="employee" className="w-full h-10 sm:h-11">
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] sm:max-h-[300px]">
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id} className="text-sm">
                      {getEmployeeName(user)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="workShift" className="text-sm font-medium">Work Shift *</Label>
              <Select 
                value={selectedWorkShiftId} 
                onValueChange={setSelectedWorkShiftId}
              >
                <SelectTrigger id="workShift" className="w-full h-10 sm:h-11">
                  <SelectValue placeholder="Select a work shift" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] sm:max-h-[300px]">
                  {workShifts.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id} className="text-sm">
                      <span className="truncate block">{shift.name} ({formatTime(shift.startTime)} - {formatTime(shift.endTime)})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-sm font-medium">Start Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal h-10 sm:h-11 text-sm"
                    >
                      <FaCalendarAlt className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{startDate ? format(startDate, 'PPP') : 'Pick a date'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-sm font-medium">End Date (Optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal h-10 sm:h-11 text-sm"
                    >
                      <FaCalendarAlt className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{endDate ? format(endDate, 'PPP') : 'Pick a date'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      disabled={(date) => (startDate ? date < startDate : false)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
              <Textarea 
                id="notes" 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="Optional notes about this assignment"
                className="min-h-[80px] text-sm resize-none"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={resetForm}
              className="w-full sm:w-auto order-2 sm:order-1 h-10 sm:h-11"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              className="w-full sm:w-auto order-1 sm:order-2 h-10 sm:h-11"
            >
              {isEditing ? 'Update Assignment' : 'Create Assignment'}
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
              Are you sure you want to delete this roster assignment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {selectedRoster && (
            <div className="py-4">
              <p className="font-medium">
                {getEmployeeName(selectedRoster.user)} - {selectedRoster.workShift.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDate(selectedRoster.startDate)} to {selectedRoster.endDate ? formatDate(selectedRoster.endDate) : 'Ongoing'}
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RosterManagement;