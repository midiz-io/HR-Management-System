import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/components/ui/use-toast';
import { FaUsers, FaMapMarkerAlt, FaCalendarCheck, FaSpinner, FaChevronRight, FaChevronLeft } from 'react-icons/fa';
import { format, startOfDay, endOfDay } from 'date-fns';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  locationId: string | null;
}

interface Location {
  id: string;
  name: string;
}

interface WorkShift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  days: string[];
}

const BulkRosterManagement: React.FC = () => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('ALL');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [repeatType, setRepeatType] = useState<'DAILY' | 'SHIFT_DEFAULT' | 'CUSTOM'>('SHIFT_DEFAULT');
  const [customDays, setCustomDays] = useState<string[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [loading, setLoading] = useState<boolean>(false);
  const { toast } = useToast();

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const toggleCustomDay = (day: string) => {
    setCustomDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, locsRes, shiftsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/locations'),
        fetch('/api/work-shifts'),
      ]);

      if (usersRes.ok) setEmployees(await usersRes.json());
      if (locsRes.ok) setLocations(await locsRes.json());
      if (shiftsRes.ok) setWorkShifts(await shiftsRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const filteredEmployees = employees.filter(emp => 
    selectedLocationId === 'ALL' || emp.locationId === selectedLocationId
  );

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployeeIds(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId) 
        : [...prev, employeeId]
    );
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredEmployees.map(e => e.id);
    setSelectedEmployeeIds(prev => Array.from(new Set([...prev, ...filteredIds])));
  };

  const clearSelection = () => {
    setSelectedEmployeeIds([]);
  };

  const handleBulkAssign = async () => {
    if (selectedEmployeeIds.length === 0 || !selectedShiftId || !startDate) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please select employees, a shift, and a start date.',
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        userIds: selectedEmployeeIds,
        workShiftId: selectedShiftId,
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : null,
        repeatType: repeatType, // DAILY, SHIFT_DEFAULT, CUSTOM
        customDays: repeatType === 'CUSTOM' ? customDays : null,
      };

      const response = await fetch('/api/rosters/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to assign rosters');
      }

      toast({
        title: 'Success',
        description: `Rosters assigned to ${selectedEmployeeIds.length} employees successfully.`,
      });

      setSelectedEmployeeIds([]);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1: Select Employees */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FaUsers className="text-primary" />
              1. Select Employees
            </CardTitle>
            <CardDescription>Filter by location and select employees to assign</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label>Filter by Location</Label>
                <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Locations</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllFiltered}>Select All</Button>
                <Button variant="ghost" size="sm" onClick={clearSelection}>Clear</Button>
              </div>
            </div>

            <div className="border rounded-md max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left w-10"></th>
                    <th className="p-2 text-left">Employee Name</th>
                    <th className="p-2 text-left">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map(emp => (
                      <tr key={emp.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => toggleEmployeeSelection(emp.id)}>
                        <td className="p-2">
                          <Checkbox checked={selectedEmployeeIds.includes(emp.id)} onCheckedChange={() => toggleEmployeeSelection(emp.id)} />
                        </td>
                        <td className="p-2 font-medium">
                          {emp.firstName && emp.lastName ? `${emp.firstName} ${emp.lastName}` : emp.email}
                        </td>
                        <td className="p-2 text-muted-foreground">{emp.email}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-muted-foreground">No employees found for this location</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="text-sm font-medium text-primary">
              {selectedEmployeeIds.length} employees selected
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Assign Roster */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FaCalendarCheck className="text-primary" />
              2. Assign Roster
            </CardTitle>
            <CardDescription>Configure the roster details for selected employees</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Work Shift</Label>
              <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Shift" />
                </SelectTrigger>
                <SelectContent>
                  {workShifts.map(shift => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {shift.name} ({shift.startTime} - {shift.endTime})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Repeat Type</Label>
              <Select value={repeatType} onValueChange={(v: any) => setRepeatType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHIFT_DEFAULT">Repeat by Shift Days</SelectItem>
                  <SelectItem value="DAILY">Daily Repeat (Everyday)</SelectItem>
                  <SelectItem value="CUSTOM">Day by Day (Custom)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground pt-1">
                {repeatType === 'DAILY' 
                  ? "This will ignore shift's day selection and apply every day."
                  : repeatType === 'CUSTOM'
                  ? "Select specific days to apply this roster."
                  : "This will follow the days selected in the work shift (e.g. Mon-Fri)."}
              </p>
            </div>

            {repeatType === 'CUSTOM' && (
              <div className="space-y-2 p-3 bg-slate-50 rounded-md border">
                <Label className="text-xs">Select Days</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {daysOfWeek.map(day => (
                    <div key={day} className="flex items-center gap-2">
                      <Checkbox 
                        id={`day-${day}`} 
                        checked={customDays.includes(day)} 
                        onCheckedChange={() => toggleCustomDay(day)} 
                      />
                      <label htmlFor={`day-${day}`} className="text-xs cursor-pointer">{day}</label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 pt-2">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                       {startDate ? format(startDate, 'PPP') : 'Pick Date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>End Date (Optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                       {endDate ? format(endDate, 'PPP') : 'Keep Ongoing'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} disabled={(date) => (startDate ? date < startDate : false)} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full h-12" onClick={handleBulkAssign} disabled={loading || selectedEmployeeIds.length === 0}>
              {loading ? <FaSpinner className="animate-spin mr-2" /> : <FaCalendarCheck className="mr-2" />}
              Assign Roster to {selectedEmployeeIds.length} Employees
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default BulkRosterManagement;
