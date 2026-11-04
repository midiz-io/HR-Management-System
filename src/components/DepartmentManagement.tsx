import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
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
import { Badge } from '@/components/ui/badge';
import { 
  FaBuilding, 
  FaUserShield, 
  FaUsers, 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaSpinner,
  FaSearch,
  FaCheck
} from 'react-icons/fa';
import { Checkbox } from '@/components/ui/checkbox';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  department: string | null;
  departmentId: string | null;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
  headId: string | null;
  head?: User | null;
  _count?: {
    employees: number;
  };
}

const DepartmentManagement: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const { toast } = useToast();

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAssignEmployeesOpen, setIsAssignEmployeesOpen] = useState(false);
  
  // Form states
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    headId: 'none'
  });
  
  // Employee assignment states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [deptRes, userRes] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/users')
      ]);

      if (deptRes.ok && userRes.ok) {
        const deptData = await deptRes.json();
        const userData = await userRes.json();
        
        setDepartments(deptData);
        setAdmins(userData.filter((u: User) => !u.isResigned));
        setEmployees(userData.filter((u: User) => !u.isResigned));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load department data'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDept = async () => {
    if (!formData.name) {
      toast({ variant: 'destructive', title: 'Error', description: 'Name is required' });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          headId: formData.headId === 'none' ? null : formData.headId
        })
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Department created successfully' });
        setIsCreateOpen(false);
        setFormData({ name: '', description: '', headId: 'none' });
        fetchData();
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create department');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateDept = async () => {
    if (!selectedDept || !formData.name) return;

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/departments/${selectedDept.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          headId: formData.headId === 'none' ? null : formData.headId
        })
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Department updated successfully' });
        setIsEditOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update department');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteDept = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department? Employees will be unassigned.')) return;

    try {
      const res = await fetch(`/api/departments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Success', description: 'Department deleted' });
        fetchData();
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete' });
    }
  };

  const openAssignEmployees = (dept: Department) => {
    setSelectedDept(dept);
    // Find employees already in this department
    const inDeptIds = employees
      .filter(e => e.departmentId === dept.id)
      .map(e => e.id);
    setSelectedEmployeeIds(inDeptIds);
    setIsAssignEmployeesOpen(true);
  };

  const handleAssignEmployees = async () => {
    if (!selectedDept) return;

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/departments/${selectedDept.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeIds: selectedEmployeeIds
        })
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Employees assigned successfully' });
        setIsAssignEmployeesOpen(false);
        fetchData();
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to assign employees' });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredEmployees = employees.filter(e => 
    e.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.firstName && e.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (e.lastName && e.lastName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <FaBuilding className="text-primary" />
            Departments
          </h2>
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1">
            Manage organizational structure and heads
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-lg shadow-primary/20 gap-2">
              <FaPlus /> CREATE DEPARTMENT
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Department</DialogTitle>
              <DialogDescription>Create a new department and assign a head.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Department Name</Label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Driver's Department"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Department Head / Sectional Head</Label>
                <Select 
                  value={formData.headId} 
                  onValueChange={v => setFormData({...formData, headId: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Sectional Head" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Head Assigned</SelectItem>
                    {admins.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.firstName} {a.lastName} ({a.position || a.role}) - {a.department || 'General'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateDept} disabled={isProcessing}>
                {isProcessing ? <FaSpinner className="animate-spin mr-2" /> : <FaCheck className="mr-2" />}
                CREATE
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <FaSpinner className="animate-spin text-4xl text-primary" />
          </div>
        ) : departments.map(dept => (
          <Card key={dept.id} className="overflow-hidden border-t-4 border-primary group hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl font-black">{dept.name}</CardTitle>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => {
                    setSelectedDept(dept);
                    setFormData({
                      name: dept.name,
                      description: dept.description || '',
                      headId: dept.headId || 'none'
                    });
                    setIsEditOpen(true);
                  }}>
                    <FaEdit className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-red-500" onClick={() => handleDeleteDept(dept.id)}>
                    <FaTrash className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <CardDescription>{dept.description || 'No description'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <FaUserShield />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Head of Department</p>
                  <p className="font-bold text-sm">
                    {dept.head ? `${dept.head.firstName} ${dept.head.lastName}` : 'UNASSIGNED'}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="rounded-lg gap-2 px-3 py-1 bg-white dark:bg-slate-950">
                  <FaUsers className="text-primary" />
                  <span className="font-bold">{dept._count?.employees || 0} Employees</span>
                </Badge>
                <Button variant="link" className="text-xs font-bold gap-1 p-0" onClick={() => openAssignEmployees(dept)}>
                  MANAGE TEAM <FaPlus className="h-2 w-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Department Name</Label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Department Head / Sectional Head</Label>
              <Select 
                value={formData.headId} 
                onValueChange={v => setFormData({...formData, headId: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Sectional Head" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Head Assigned</SelectItem>
                  {admins.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.firstName} {a.lastName} ({a.position || a.role}) - {a.department || 'General'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateDept} disabled={isProcessing}>
              {isProcessing && <FaSpinner className="animate-spin mr-2" />}
              SAVE CHANGES
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Employees Dialog */}
      <Dialog open={isAssignEmployeesOpen} onOpenChange={setIsAssignEmployeesOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Assign Employees to {selectedDept?.name}</DialogTitle>
            <DialogDescription>Select employees to add to this department. Employees can only be in one department.</DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center gap-2 my-4 px-1">
            <FaSearch className="text-muted-foreground" />
            <Input 
              placeholder="Search by name or email..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Current Department</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map(emp => (
                  <TableRow key={emp.id} className="cursor-pointer" onClick={() => toggleEmployee(emp.id)}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox 
                        checked={selectedEmployeeIds.includes(emp.id)}
                        onCheckedChange={() => toggleEmployee(emp.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold">{emp.firstName} {emp.lastName}</span>
                        <span className="text-xs text-muted-foreground">{emp.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {emp.department ? (
                        <Badge variant="secondary" className={emp.departmentId === selectedDept?.id ? 'bg-primary/10 text-primary' : ''}>
                          {emp.department}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="pt-4 border-t mt-4">
            <div className="flex justify-between items-center w-full">
              <span className="text-sm font-bold">{selectedEmployeeIds.length} employees selected</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsAssignEmployeesOpen(false)}>CANCEL</Button>
                <Button onClick={handleAssignEmployees} disabled={isProcessing}>
                  {isProcessing && <FaSpinner className="animate-spin mr-2" />}
                  ASSIGN TEAM
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DepartmentManagement;
