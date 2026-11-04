import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  FaUserPlus,
  FaSpinner,
  FaEdit,
  FaTrash,
  FaSearch,
  FaFilter,
  FaUserCog,
  FaClock,
  FaDownload,
  FaUndo,
  FaRobot,
  FaCopy,
  FaCheck,
  FaEye,
  FaEyeSlash
} from 'react-icons/fa';
import { AutoCheckoutDialog } from '@/components/AutoCheckoutDialog';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  position: string | null;
  joinDate: string | null;
  locationId: string | null;
  phoneNumber?: string | null;
  createdAt: string;
  department?: string | null;
  password?: string | null;
}

interface WorkShift {
  id: string;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string;
  days: string[];
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showResigned, setShowResigned] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<{
    firstName: string;
    lastName: string;
    position: string;
    role: string;
    joinDate: string;
    locationId: string | null;
    phoneNumber: string;
    offDaysCount: string;
  }>({
    firstName: '',
    lastName: '',
    position: '',
    role: 'EMPLOYEE',
    joinDate: '',
    locationId: null,
    phoneNumber: '',
    offDaysCount: '',
  });
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [showAssignShiftDialog, setShowAssignShiftDialog] = useState<boolean>(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedWorkShiftId, setSelectedWorkShiftId] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [downloadingQR, setDownloadingQR] = useState<boolean>(false);
  const [showAutoCheckoutDialog, setShowAutoCheckoutDialog] = useState<boolean>(false);
  const [autoCheckoutTargetUser, setAutoCheckoutTargetUser] = useState<User | null>(null);
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);
  const [copiedPasswordId, setCopiedPasswordId] = useState<string | null>(null);
  const [visiblePasswordUserIds, setVisiblePasswordUserIds] = useState<Record<string, boolean>>({});

  const getDefaultPassword = (user: User): string => {
    if (user.password) return user.password;
    if (user.role === 'SUPER_ADMIN') return 'SuperAdmin@2026';
    if (user.role === 'ADMIN') return 'Admin@2026';
    if (user.role === 'MANAGER') return 'Manager@2026';
    const prefix = (user.firstName || user.email.split('@')[0] || 'User').replace(/[^a-zA-Z0-9]/g, '');
    return `${prefix}@123`;
  };

  const handleCopyEmail = (e: React.MouseEvent, user: User) => {
    e.stopPropagation();
    if (!user.email) return;
    navigator.clipboard.writeText(user.email);
    setCopiedEmailId(user.id);
    setTimeout(() => setCopiedEmailId(null), 2000);
    toast({
      title: 'Email Copied',
      description: `${user.email} copied to clipboard!`,
    });
  };

  const handleCopyPassword = (e: React.MouseEvent, user: User) => {
    e.stopPropagation();
    const pwd = user.password || getDefaultPassword(user);
    if (!pwd) return;
    navigator.clipboard.writeText(pwd);
    setCopiedPasswordId(user.id);
    setTimeout(() => setCopiedPasswordId(null), 2000);
    toast({
      title: 'Password Copied',
      description: `Password for ${user.firstName || user.email} copied to clipboard!`,
    });
  };

  const togglePasswordVisibility = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    setVisiblePasswordUserIds((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  // Fetch users and work shifts on component mount
  useEffect(() => {
    fetchWorkShifts();
    fetchCurrentUserRole();
    fetchLocations();
  }, []);

  useEffect(() => {
    fetchUsers(showResigned);
  }, [showResigned]);

  // Fetch current user's role from database
  const fetchCurrentUserRole = async () => {
    try {
      const response = await fetch('/api/user');
      if (response.ok) {
        const data = await response.json();
        setCurrentUserRole(data.role);
      }
    } catch (error) {
      console.error('Error fetching current user role:', error);
    }
  };

  // Fetch users from API
  const fetchUsers = async (resigned: boolean = showResigned) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/users?resignedOnly=${resigned}`);
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
    } finally {
      setLoading(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle location selection
  const handleLocationChange = (value: string) => {
    setFormData((prev) => ({ ...prev, locationId: value === 'NONE' ? null : value }));
  };

  // Handle role selection
  const handleRoleChange = (value: string) => {
    setFormData((prev) => ({ ...prev, role: value }));
  };

  // Set form data when editing a user
  const handleEditUser = async (user: User) => {
    setEditingUser(user);
    let offDaysCount = '';
    try {
      const res = await fetch(`/api/users/${user.id}`);
      if (res.ok) {
        const detail = await res.json();
        offDaysCount = String(detail.salaryConfig?.offDaysCount ?? '');
      }
    } catch {
      /* use empty default */
    }
    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      position: user.position || '',
      role: user.role,
      joinDate: user.joinDate ? user.joinDate.split('T')[0] : '',
      locationId: user.locationId || null,
      phoneNumber: (user as any).phoneNumber || '',
      offDaysCount,
    });
  };

  // Fetch locations from API
  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations');
      if (response.ok) {
        const data = await response.json();
        setLocations(data);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
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

  // Reset form data
  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      firstName: '',
      lastName: '',
      position: '',
      role: 'EMPLOYEE',
      joinDate: '',
      locationId: null,
      phoneNumber: '',
      offDaysCount: '',
    });
  };

  // Load scripts dynamically
  const loadScript = (src: string) => {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) return resolve(true);
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve(true);
      script.onerror = reject;
      document.body.appendChild(script);
    });
  };

  // Handle bulk QR download
  const handleBulkQRDownload = async () => {
    try {
      setDownloadingQR(true);
      toast({ title: 'Preparing Download', description: 'Loading required libraries...' });
      
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js');
      
      const JSZip = (window as any).JSZip;
      const QRious = (window as any).QRious;
      
      if (!JSZip || !QRious) throw new Error('Failed to load libraries');

      toast({ title: 'Generating QR Codes', description: 'This may take a moment...' });
      
      const zip = new JSZip();
      
      for (const user of users) {
        // Find department, default to Unassigned
        const dept = user.department || 'Unassigned';
        
        // Find name
        const name = (user.firstName && user.lastName) 
          ? `${user.firstName}_${user.lastName}` 
          : (user.firstName || user.email.split('@')[0] || 'Unknown');
          
        // QR Code value
        const verifyUrl = `${window.location.origin}/verify/${user.id}`;
        
        // Generate QR code data URL using QRious
        const qr = new QRious({
          value: verifyUrl,
          size: 400,
          background: 'white',
          foreground: 'black'
        });
        
        const dataUrl = qr.toDataURL('image/png');
        
        // Extract base64 part
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
        
        // Add to zip under department folder
        zip.folder(dept)?.file(`${name}_QR.png`, base64Data, { base64: true });
      }
      
      toast({ title: 'Creating Archive', description: 'Zipping files...' });
      
      const content = await zip.generateAsync({ type: 'blob' });
      
      // Download
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Employee_QR_Codes_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({ title: 'Success', description: 'Bulk download completed successfully!' });
      
    } catch (error: any) {
      console.error('QR bulk download error:', error);
      toast({ variant: 'destructive', title: 'Download Failed', description: error.message || 'Failed to download QR codes' });
    } finally {
      setDownloadingQR(false);
    }
  };

  // Reset assign shift dialog
  const resetAssignShiftDialog = () => {
    setSelectedUserId('');
    setSelectedWorkShiftId('');
    setShowAssignShiftDialog(false);
    setSelectedUser(null);
  };

  // Handle form submission for updating a user
  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      setLoading(true);

      // Send update user request
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to update user');
      }

      toast({
        title: 'Success',
        description: 'User updated successfully',
      });

      // Reset form and refresh users
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update user',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle resetting a user's password
  const handleResetPassword = async (newPassword: string) => {
    if (!editingUser || !newPassword) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/users/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: editingUser.id,
          password: newPassword 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === editingUser.id ? { ...u, password: newPassword } : u))
      );

      toast({
        title: 'Success',
        description: 'Password reset successfully',
      });
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to reset password',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle resigning a user (replaces delete)
  const handleResignUser = (userId: string, userName: string) => {
    // 1. Hide the user optimistically
    const userToResign = users.find(u => u.id === userId);
    if (!userToResign) return;
    
    setUsers(prev => prev.filter(u => u.id !== userId));

    // 2. Start a 10s timer for the actual API call
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/users/${userId}/resign`, {
          method: 'POST',
        });
        if (!response.ok) {
          throw new Error('Failed to resign user');
        }
      } catch (error: any) {
        console.error('Resignation failed:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'Failed to resign user',
        });
        // Revert UI on failure
        setUsers(prev => [...prev, userToResign].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
    }, 10000);

    // 3. Show a toast with UNDO action
    toast({
      title: 'Employee Resigned',
      description: `${userName} will be permanently removed in 10 seconds.`,
      duration: 10000,
      action: (
        <ToastAction
          altText="Undo"
          onClick={() => {
            clearTimeout(timeoutId);
            setUsers(prev => [...prev, userToResign].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            toast({
              title: 'Undo Successful',
              description: 'Employee resignation was cancelled.',
            });
          }}
        >
          Undo
        </ToastAction>
      ),
    });
  };

  // Handle reactivating a user
  const handleReactivateUser = async (userId: string, userName: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/users/${userId}/reactivate`, {
        method: 'POST',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to reactivate user');
      }
      
      toast({
        title: 'Employee Reactivated',
        description: `${userName} has been successfully reactivated.`,
      });
      
      // Refresh the list
      fetchUsers(showResigned);
    } catch (error: any) {
      console.error('Reactivation failed:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to reactivate user',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle assigning a work shift to a user
  const handleAssignWorkShift = async () => {
    if (!selectedUserId || !selectedWorkShiftId) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please select a work shift',
      });
      return;
    }

    try {
      setLoading(true);

      // Get the current work shift to get its employees
      const response = await fetch(`/api/work-shifts/${selectedWorkShiftId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch work shift details');
      }

      const workShift = await response.json();

      // Check if the user is already assigned to this work shift
      const isAlreadyAssigned = workShift.employees.some((emp: any) => emp.id === selectedUserId);

      // Prepare the employee IDs (existing + new one if not already assigned)
      const employeeIds = isAlreadyAssigned
        ? workShift.employees.map((emp: any) => emp.id)
        : [...workShift.employees.map((emp: any) => emp.id), selectedUserId];

      // Update the work shift with the new employee assignment
      const updateResponse = await fetch(`/api/work-shifts/${selectedWorkShiftId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: workShift.name,
          description: workShift.description,
          startTime: workShift.startTime,
          endTime: workShift.endTime,
          days: workShift.days,
          employeeIds: employeeIds,
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error || 'Failed to assign work shift');
      }

      toast({
        title: 'Success',
        description: `Work shift assigned to ${selectedUser?.firstName || ''} ${selectedUser?.lastName || selectedUser?.email || ''}`,
      });

      // Reset dialog and refresh data
      resetAssignShiftDialog();
      fetchWorkShifts();
    } catch (error: any) {
      console.error('Error assigning work shift:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to assign work shift',
      });
    } finally {
      setLoading(false);
    }
  };

  // Format time for display
  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10));
    date.setMinutes(parseInt(minutes, 10));
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(date);
  };

  // Filter users based on search term and role filter
  const filteredUsers = users.filter(user => {
    const matchesSearch =
      searchTerm === '' ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.firstName && user.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.lastName && user.lastName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            View and manage all users in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={() => setShowResigned(false)}
                className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${!showResigned ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground'}`}
              >
                Active Employees
              </button>
              <button
                type="button"
                onClick={() => setShowResigned(true)}
                className={`px-4 py-2 text-sm font-medium rounded-r-lg border-t border-b border-r border-l-0 ${showResigned ? 'bg-primary text-primary-foreground border-primary border-l-primary' : 'bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground'}`}
              >
                Resigned Employees
              </button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="w-full sm:w-48">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Roles</SelectItem>
                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                variant="outline" 
                onClick={handleBulkQRDownload} 
                disabled={downloadingQR || users.length === 0}
                title="Download all QR codes as ZIP"
                className="whitespace-nowrap"
              >
                {downloadingQR ? <FaSpinner className="animate-spin h-4 w-4 mr-2" /> : <FaDownload className="h-4 w-4 mr-2" />}
                <span className="hidden sm:inline">Bulk QR</span>
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <FaSpinner className="animate-spin h-8 w-8 text-primary" />
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden lg:table-cell">Position</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>
                            {user.firstName && user.lastName
                              ? `${user.firstName} ${user.lastName}`
                              : 'Not set'}
                          </span>
                          <div className="sm:hidden flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {user.email}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyEmail(e, user)}
                              className={`p-1 rounded transition-colors ${copiedEmailId === user.id ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" : (user.role === "ADMIN" || user.role === "SUPER_ADMIN") ? "text-primary bg-primary/10 hover:bg-primary/20" : "text-muted-foreground hover:text-foreground"}`}
                              title={copiedEmailId === user.id ? "Copied!" : "Copy Email"}
                            >
                              {copiedEmailId === user.id ? (
                                <FaCheck className="h-2.5 w-2.5 text-emerald-600" />
                              ) : (
                                <FaCopy className="h-2.5 w-2.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-2 group">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[220px]" title={user.email}>
                            {user.email}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyEmail(e, user)}
                            className={`p-1.5 rounded-md transition-all duration-150 inline-flex items-center justify-center ${
                              copiedEmailId === user.id
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 ring-1 ring-emerald-500/20'
                                : (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')
                                  ? 'bg-primary/10 text-primary hover:bg-primary/20 hover:scale-105 shadow-xs'
                                  : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted opacity-80 group-hover:opacity-100'
                            }`}
                            title={copiedEmailId === user.id ? 'Copied!' : `Copy ${user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' ? user.role + ' ' : ''}Email`}
                          >
                            {copiedEmailId === user.id ? (
                              <FaCheck className="h-3.5 w-3.5 text-emerald-600 animate-in zoom-in-75 duration-150" />
                            ) : (
                              <FaCopy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div 
                            className="font-mono text-xs font-semibold bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-md min-w-[95px] text-center select-all border border-slate-200/80 dark:border-slate-700/60 shadow-xs"
                            title={visiblePasswordUserIds[user.id] ? 'Visible Password' : 'Click Eye Icon to View'}
                          >
                            {visiblePasswordUserIds[user.id]
                              ? (user.password || getDefaultPassword(user))
                              : '••••••••'}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => togglePasswordVisibility(e, user.id)}
                            className={`p-1.5 rounded-md transition-all duration-150 ${
                              visiblePasswordUserIds[user.id]
                                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            title={visiblePasswordUserIds[user.id] ? 'Hide Password' : 'View Password'}
                          >
                            {visiblePasswordUserIds[user.id] ? (
                              <FaEyeSlash className="h-3.5 w-3.5" />
                            ) : (
                              <FaEye className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleCopyPassword(e, user)}
                            className={`p-1.5 rounded-md transition-all duration-150 ${
                              copiedPasswordId === user.id
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 ring-1 ring-emerald-500/20'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            title={copiedPasswordId === user.id ? 'Copied!' : 'Copy Password'}
                          >
                            {copiedPasswordId === user.id ? (
                              <FaCheck className="h-3.5 w-3.5 text-emerald-600 animate-in zoom-in-75 duration-150" />
                            ) : (
                              <FaCopy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${user.role === 'SUPER_ADMIN'
                          ? 'bg-red-100 text-red-800'
                          : user.role === 'ADMIN'
                            ? 'bg-primary/20 text-primary'
                            : user.role === 'MANAGER'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                          {user.role}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{user.position || 'Not set'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          {!showResigned ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedUserId(user.id);
                                  setSelectedUser(user);
                                  setShowAssignShiftDialog(true);
                                }}
                                title="Assign Work Shift"
                              >
                                <FaClock className="h-4 w-4" />
                              </Button>
                              {(currentUserRole === 'ADMIN' || currentUserRole === 'SUPER_ADMIN') && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setAutoCheckoutTargetUser(user);
                                    setShowAutoCheckoutDialog(true);
                                  }}
                                  className="bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
                                  title="Schedule Auto Check-Out"
                                >
                                  <FaRobot className="h-4 w-4 text-primary" />
                                </Button>
                              )}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditUser(user)}
                              >
                                <FaEdit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border-t-4 border-primary p-4 sm:p-6 shadow-2xl">
                              <DialogHeader>
                                <DialogTitle>Edit User</DialogTitle>
                                <DialogDescription>
                                  Update user information and role
                                </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="firstName">First Name</Label>
                                    <Input
                                      id="firstName"
                                      name="firstName"
                                      value={formData.firstName}
                                      onChange={handleInputChange}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="lastName">Last Name</Label>
                                    <Input
                                      id="lastName"
                                      name="lastName"
                                      value={formData.lastName}
                                      onChange={handleInputChange}
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="position">Position</Label>
                                    <Input
                                      id="position"
                                      name="position"
                                      value={formData.position}
                                      onChange={handleInputChange}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="role">Role</Label>
                                    <Select
                                      value={formData.role}
                                      onValueChange={handleRoleChange}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select role" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                                        <SelectItem value="ADMIN">Admin</SelectItem>
                                        <SelectItem value="MANAGER">Manager</SelectItem>
                                        <SelectItem value="EMPLOYEE">Employee</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="joinDate">Join Date</Label>
                                    <Input
                                      id="joinDate"
                                      name="joinDate"
                                      type="date"
                                      value={formData.joinDate}
                                      onChange={handleInputChange}
                                      disabled={currentUserRole === 'MANAGER' || currentUserRole === 'EMPLOYEE'}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="locationId">Location</Label>
                                    <Select
                                      value={formData.locationId || 'NONE'}
                                      onValueChange={handleLocationChange}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="No location assigned" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="NONE">No location assigned</SelectItem>
                                        {locations.map((loc) => (
                                          <SelectItem key={loc.id} value={loc.id}>
                                            {loc.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                                  <Label htmlFor="newPassword">Reset Password (Optional)</Label>
                                  <div className="flex gap-2">
                                    <Input
                                      id="newPassword"
                                      type="password"
                                      placeholder="Enter new password"
                                      className="flex-1"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleResetPassword((e.target as HTMLInputElement).value);
                                          (e.target as HTMLInputElement).value = '';
                                        }
                                      }}
                                    />
                                    <Button 
                                      type="button" 
                                      variant="outline"
                                      onClick={(e) => {
                                        const input = document.getElementById('newPassword') as HTMLInputElement;
                                        handleResetPassword(input.value);
                                        input.value = '';
                                      }}
                                    >
                                      Save Password
                                    </Button>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground italic">
                                    Press Save or Enter to update the password permanently.
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="phoneNumber">Phone Number (for SMS notifications)</Label>
                                  <Input
                                    id="phoneNumber"
                                    name="phoneNumber"
                                    placeholder="+947XXXXXXXX"
                                    value={formData.phoneNumber}
                                    onChange={handleInputChange}
                                  />
                                </div>
                                {(currentUserRole === 'ADMIN' || currentUserRole === 'SUPER_ADMIN') && (
                                  <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <Label htmlFor="offDaysCount">Monthly Off Days (count)</Label>
                                    <Input
                                      id="offDaysCount"
                                      name="offDaysCount"
                                      type="number"
                                      min={0}
                                      step={1}
                                      placeholder="0"
                                      value={formData.offDaysCount}
                                      onChange={handleInputChange}
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                      Used in payroll: off day payment = (daily rate × off days) × 2. Also editable under Payroll &amp; Salary.
                                    </p>
                                  </div>
                                )}
                              </div>
                              <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                                <Button
                                  variant="outline"
                                  onClick={resetForm}
                                  className="w-full sm:w-auto"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={handleUpdateUser}
                                  disabled={loading}
                                  className="w-full sm:w-auto"
                                >
                                  {loading ? (
                                    <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <FaUserCog className="mr-2 h-4 w-4" />
                                  )}
                                  Update User
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                disabled={loading}
                              >
                                <FaTrash className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border-t-4 border-red-600 p-4 sm:p-6 shadow-2xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Resign Employee</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to resign 
                                  <strong> {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}</strong>?
                                  <br/><br/>
                                  This will remove their active attendance, leaves, and other assignments.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleResignUser(
                                    user.id,
                                    user.firstName && user.lastName
                                      ? `${user.firstName} ${user.lastName}`
                                      : user.email
                                  )}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {loading ? (
                                    <>
                                      <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                                      Resigning...
                                    </>
                                  ) : (
                                    <>
                                      <FaTrash className="mr-2 h-4 w-4" />
                                      Resign Employee
                                    </>
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleReactivateUser(
                                user.id,
                                user.firstName && user.lastName
                                  ? `${user.firstName} ${user.lastName}`
                                  : user.email
                              )}
                              disabled={loading}
                              title="Reactivate Employee"
                            >
                              <FaUndo className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No users found matching your search criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Work Shift Dialog */}
      <Dialog open={showAssignShiftDialog} onOpenChange={setShowAssignShiftDialog}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border-t-4 border-primary p-4 sm:p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle>Assign Work Shift</DialogTitle>
            <DialogDescription>
              Assign a work shift to {selectedUser?.firstName || ''} {selectedUser?.lastName || selectedUser?.email || ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workShift">Select Work Shift</Label>
              <Select
                value={selectedWorkShiftId}
                onValueChange={setSelectedWorkShiftId}
              >
                <SelectTrigger id="workShift">
                  <SelectValue placeholder="Select a work shift" />
                </SelectTrigger>
                <SelectContent>
                  {workShifts.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {shift.name} ({formatTime(shift.startTime)} - {formatTime(shift.endTime)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={resetAssignShiftDialog} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleAssignWorkShift} disabled={loading} className="w-full sm:w-auto">
              {loading ? (
                <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FaClock className="mr-2 h-4 w-4" />
              )}
              Assign Work Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {autoCheckoutTargetUser && (
        <AutoCheckoutDialog
          isOpen={showAutoCheckoutDialog}
          onClose={() => {
            setShowAutoCheckoutDialog(false);
            setAutoCheckoutTargetUser(null);
          }}
          userId={autoCheckoutTargetUser.id}
          userName={
            autoCheckoutTargetUser.firstName && autoCheckoutTargetUser.lastName
              ? `${autoCheckoutTargetUser.firstName} ${autoCheckoutTargetUser.lastName}`
              : autoCheckoutTargetUser.email
          }
          userRole={currentUserRole}
        />
      )}
    </div>
  );
};

export default UserManagement;
