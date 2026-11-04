import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { getLocationColor } from '@/lib/locationColors';
import {
  MapPin,
  Clock,
  Calendar,
  Search,
  CheckCircle2,
  RefreshCw,
  Play,
  Save,
  Sparkles,
  Users,
  UserCheck,
  Edit3,
  Check,
  Plus,
  ArrowUpRight,
  Zap,
  ShieldCheck,
  Briefcase,
} from 'lucide-react';

interface LocationItem {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface PortalEmployee {
  id: string;
  sequentialId: number;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string;
  position: string;
  department: string;
  role: string;
  assignedLocationId: string | null;
  assignedLocationName: string;
  effectiveLocationId: string;
  effectiveLocationName: string;
  rosterStartTime: string | null;
  rosterEndTime: string | null;
  isScheduledInPortal: boolean;
  portalConfig: {
    enabled: boolean;
    locationId?: string;
    locationName: string;
    checkInTime?: string;
    checkOutTime?: string;
    updatedAt?: string;
  } | null;
  attendance: {
    id: string;
    locationId: string;
    locationName: string;
    checkInTime: string;
    checkOutTime: string | null;
    checkInTimeHHMM: string | null;
    checkOutTimeHHMM: string | null;
    status: string;
  } | null;
}

interface RowEditState {
  locationName: string;
  position: string;
  checkInTime: string;
  checkOutTime: string;
  isCustomLocation: boolean;
  autoSchedule: boolean;
}

export default function LocationsPortalPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [employees, setEmployees] = useState<PortalEmployee[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);

  // Target Date (defaults to today in YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    format(new Date(), 'yyyy-MM-dd')
  );

  // Global Schedule / Cron Settings
  const [cronEnabled, setCronEnabled] = useState<boolean>(true);
  const [cronCheckInTime, setCronCheckInTime] = useState<string>('08:30');
  const [cronCheckOutTime, setCronCheckOutTime] = useState<string>('17:00');
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [savingSchedule, setSavingSchedule] = useState<boolean>(false);
  const [runningCronPhase, setRunningCronPhase] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewFilter, setViewFilter] = useState<
    'ALL' | 'SCHEDULED' | 'PRESENT' | 'NOT_MARKED'
  >('ALL');

  // Bulk Selection & Bulk Controls
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkLocationName, setBulkLocationName] = useState<string>('');
  const [bulkCheckInTime, setBulkCheckInTime] = useState<string>('08:30');
  const [bulkCheckOutTime, setBulkCheckOutTime] = useState<string>('17:00');
  const [applyingBulk, setApplyingBulk] = useState<boolean>(false);

  // Per-row state
  const [rowEdits, setRowEdits] = useState<Record<string, RowEditState>>({});
  const [applyingUserId, setApplyingUserId] = useState<string | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [autoApplyOnLocationSelect, setAutoApplyOnLocationSelect] =
    useState<boolean>(true);

  // Live Clock (Sri Lanka Time)
  const [liveClock, setLiveClock] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      try {
        const nowStr = new Date().toLocaleTimeString('en-GB', {
          timeZone: 'Asia/Colombo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        setLiveClock(nowStr);
      } catch {
        setLiveClock(format(new Date(), 'HH:mm:ss'));
      }
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchPortalData = useCallback(
    async (dateToLoad: string = selectedDate, silent = false) => {
      try {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        const res = await fetch(
          `/api/locations-portal?date=${encodeURIComponent(dateToLoad)}`
        );
        if (!res.ok) {
          throw new Error('Failed to load /locations portal data');
        }
        const data = await res.json();

        setEmployees(data.employees || []);
        setLocations(data.locations || []);

        const schedCheckIn = data.scheduleSettings?.checkInTime || '08:30';
        const schedCheckOut = data.scheduleSettings?.checkOutTime || '17:00';

        if (!silent) {
          setCronEnabled(data.scheduleSettings?.enabled !== false);
          setCronCheckInTime(schedCheckIn);
          setCronCheckOutTime(schedCheckOut);
          setBulkCheckInTime(schedCheckIn);
          setBulkCheckOutTime(schedCheckOut);
        }
        setLastRunAt(data.scheduleSettings?.lastRunAt || null);

        // Initialize row edit states
        const initialEdits: Record<string, RowEditState> = {};
        const knownLocNames = new Set(
          (data.locations || []).map((l: LocationItem) => l.name.toLowerCase())
        );

        for (const emp of data.employees || []) {
          const defaultLoc =
            emp.attendance?.locationName ||
            emp.portalConfig?.locationName ||
            emp.assignedLocationName ||
            data.locations?.[0]?.name ||
            'Head Office';

          const defaultIn =
            emp.attendance?.checkInTimeHHMM ||
            emp.portalConfig?.checkInTime ||
            emp.rosterStartTime ||
            schedCheckIn;

          const defaultOut =
            emp.attendance?.checkOutTimeHHMM ||
            emp.portalConfig?.checkOutTime ||
            emp.rosterEndTime ||
            schedCheckOut;

          const isCustom =
            Boolean(defaultLoc) &&
            !knownLocNames.has(defaultLoc.toLowerCase());

          initialEdits[emp.id] = {
            locationName: defaultLoc,
            position: emp.position || 'Employee',
            checkInTime: defaultIn,
            checkOutTime: defaultOut,
            isCustomLocation: isCustom,
            autoSchedule: Boolean(emp.isScheduledInPortal),
          };
        }
        setRowEdits(initialEdits);
      } catch (error: any) {
        console.error('Error loading locations portal:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'Could not load locations portal',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDate, toast]
  );

  useEffect(() => {
    fetchPortalData(selectedDate);
  }, [selectedDate, fetchPortalData]);

  // Background heartbeat every 30s to trigger daily scheduled auto check-in/out when time arrives
  useEffect(() => {
    const interval = setInterval(() => {
      if (cronEnabled) {
        fetch('/api/cron/auto-checkin')
          .then((r) => r.json())
          .then((res) => {
            if (res.checkedInCount > 0 || res.checkedOutCount > 0) {
              fetchPortalData(selectedDate, true);
            }
          })
          .catch(() => {});
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [cronEnabled, selectedDate, fetchPortalData]);

  const updateRowEdit = (userId: string, patch: Partial<RowEditState>) => {
    setRowEdits((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {
          locationName: 'Head Office',
          position: 'Employee',
          checkInTime: cronCheckInTime,
          checkOutTime: cronCheckOutTime,
          isCustomLocation: false,
          autoSchedule: false,
        }),
        ...patch,
      },
    }));
  };

  // Apply fake location attendance for a single employee
  const handleApplySingleEmployee = async (
    emp: PortalEmployee,
    overrideLocationName?: string,
    mode: 'BOTH' | 'CHECK_IN_ONLY' | 'CHECK_OUT_ONLY' = 'BOTH'
  ) => {
    const edit = rowEdits[emp.id];
    const locName = (
      overrideLocationName !== undefined
        ? overrideLocationName
        : edit?.locationName || ''
    ).trim();

    if (!locName) {
      toast({
        variant: 'destructive',
        title: 'Location Required',
        description: `Please enter or select a location for ${emp.fullName}.`,
      });
      return;
    }

    const checkInTime = edit?.checkInTime || cronCheckInTime || '08:30';
    const checkOutTime = edit?.checkOutTime || cronCheckOutTime || '17:00';

    try {
      setApplyingUserId(emp.id);

      // If position was edited, also update it
      if (edit?.position && edit.position !== emp.position) {
        await fetch('/api/locations-portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'UPDATE_EMPLOYEE_CONFIG',
            userId: emp.id,
            locationName: locName,
            position: edit.position,
            enabled: true,
            checkInTime,
            checkOutTime,
          }),
        });
      }

      const res = await fetch('/api/locations-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPLY_ATTENDANCE',
          items: [
            {
              userId: emp.id,
              locationName: locName,
              date: selectedDate,
              checkInTime,
              checkOutTime,
              addToAutoSchedule: true,
              mode,
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to apply attendance');
      }

      toast({
        title: 'Attendance & Location Applied',
        description: `${emp.fullName} marked PRESENT at "${locName}" on ${selectedDate} (${
          mode === 'CHECK_IN_ONLY'
            ? `In: ${checkInTime}`
            : `In: ${checkInTime} - Out: ${checkOutTime}`
        }).`,
      });

      await fetchPortalData(selectedDate, true);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to Apply',
        description: error.message || 'Could not apply attendance',
      });
    } finally {
      setApplyingUserId(null);
    }
  };

  // Toggle whether an employee is in the /locations daily auto-cron schedule
  const handleToggleEmployeeCron = async (
    emp: PortalEmployee,
    enabled: boolean
  ) => {
    const edit = rowEdits[emp.id];
    const locName = (edit?.locationName || 'Head Office').trim();

    try {
      setTogglingUserId(emp.id);
      updateRowEdit(emp.id, { autoSchedule: enabled });

      const res = await fetch('/api/locations-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_EMPLOYEE_CONFIG',
          userId: emp.id,
          locationName: locName,
          enabled,
          checkInTime: edit?.checkInTime || cronCheckInTime,
          checkOutTime: edit?.checkOutTime || cronCheckOutTime,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update employee schedule status');
      }

      toast({
        title: enabled
          ? 'Added to Daily Auto-Cron'
          : 'Removed from Daily Auto-Cron',
        description: enabled
          ? `${emp.fullName} will automatically check in & out daily at "${locName}".`
          : `${emp.fullName} removed from daily automated check-in/out.`,
      });

      await fetchPortalData(selectedDate, true);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message,
      });
    } finally {
      setTogglingUserId(null);
    }
  };

  // Save Global Cron Schedule Settings
  const handleSaveScheduleSettings = async () => {
    try {
      setSavingSchedule(true);
      const res = await fetch('/api/locations-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE_SCHEDULE_SETTINGS',
          enabled: cronEnabled,
          checkInTime: cronCheckInTime,
          checkOutTime: cronCheckOutTime,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save schedule');
      }

      toast({
        title: 'Daily Automation Schedule Saved',
        description: `Daily Auto Check-In: ${cronCheckInTime} | Auto Check-Out: ${cronCheckOutTime} (${
          cronEnabled ? 'ACTIVE' : 'PAUSED'
        })`,
      });

      await fetchPortalData(selectedDate, true);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error Saving Schedule',
        description: error.message,
      });
    } finally {
      setSavingSchedule(false);
    }
  };

  // Trigger Cron Job Manually Now for all scheduled /locations employees
  const handleRunCronNow = async (phase: 'CHECK_IN' | 'CHECK_OUT' | 'BOTH') => {
    try {
      setRunningCronPhase(phase);
      const res = await fetch('/api/locations-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TRIGGER_CRON_NOW',
          phase,
          date: selectedDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to trigger cron automation');
      }

      toast({
        title: 'Scheduled Automation Executed',
        description: `Processed ${
          data.processedUsers?.length || 0
        } scheduled employee(s) for ${selectedDate}.`,
      });

      await fetchPortalData(selectedDate, true);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Execution Failed',
        description: error.message,
      });
    } finally {
      setRunningCronPhase(null);
    }
  };

  // Bulk Apply Selected Employees
  const handleBulkApply = async () => {
    if (selectedUserIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Employees Selected',
        description: 'Select one or more employees from the table first.',
      });
      return;
    }

    try {
      setApplyingBulk(true);
      const items = selectedUserIds.map((uid) => {
        const edit = rowEdits[uid];
        const loc = (
          bulkLocationName.trim() ||
          edit?.locationName ||
          'Head Office'
        ).trim();
        return {
          userId: uid,
          locationName: loc,
          date: selectedDate,
          checkInTime: bulkCheckInTime || edit?.checkInTime || cronCheckInTime,
          checkOutTime:
            bulkCheckOutTime || edit?.checkOutTime || cronCheckOutTime,
          addToAutoSchedule: true,
          mode: 'BOTH' as const,
        };
      });

      const res = await fetch('/api/locations-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPLY_ATTENDANCE',
          items,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Bulk apply failed');
      }

      toast({
        title: 'Bulk Attendance Applied',
        description: `Marked Check-In & Check-Out for ${data.appliedCount} employee(s) on ${selectedDate}.`,
      });

      setSelectedUserIds([]);
      await fetchPortalData(selectedDate, true);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Bulk Apply Failed',
        description: error.message,
      });
    } finally {
      setApplyingBulk(false);
    }
  };

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const edit = rowEdits[emp.id];
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matches =
          emp.fullName.toLowerCase().includes(q) ||
          emp.email.toLowerCase().includes(q) ||
          (emp.position || '').toLowerCase().includes(q) ||
          (emp.department || '').toLowerCase().includes(q) ||
          (edit?.locationName || emp.effectiveLocationName || '')
            .toLowerCase()
            .includes(q);
        if (!matches) return false;
      }

      if (viewFilter === 'SCHEDULED') {
        return Boolean(edit?.autoSchedule ?? emp.isScheduledInPortal);
      }
      if (viewFilter === 'PRESENT') {
        return Boolean(emp.attendance && emp.attendance.status !== 'ABSENT');
      }
      if (viewFilter === 'NOT_MARKED') {
        return !emp.attendance || emp.attendance.status === 'ABSENT';
      }
      return true;
    });
  }, [employees, rowEdits, searchQuery, viewFilter]);

  const stats = useMemo(() => {
    const total = employees.length;
    const scheduled = employees.filter(
      (e) => rowEdits[e.id]?.autoSchedule ?? e.isScheduledInPortal
    ).length;
    const present = employees.filter(
      (e) => e.attendance && e.attendance.status !== 'ABSENT'
    ).length;
    const notMarked = total - present;
    return { total, scheduled, present, notMarked };
  }, [employees, rowEdits]);

  const toggleSelectAll = () => {
    if (
      selectedUserIds.length === filteredEmployees.length &&
      filteredEmployees.length > 0
    ) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredEmployees.map((e) => e.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <>
      <Head>
        <title>Employee Locations & Attendance Automation Portal | AttendX</title>
      </Head>

      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16">
        {/* Top Portal Header */}
        <header className="sticky top-0 z-30 border-b bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                    Locations Attendance Portal
                  </h1>
                  <Badge
                    variant="secondary"
                    className="text-[11px] font-semibold bg-primary/10 text-primary border-primary/20"
                  >
                    /locations
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Assign custom locations, apply timestamps & dates, and manage daily auto check-in/out
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border text-xs font-medium">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">SL Time:</span>
                <span className="font-mono font-bold">{liveClock || '--:--:--'}</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchPortalData(selectedDate, true)}
                disabled={refreshing}
                className="h-8 text-xs gap-1.5"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>

              <Link href="/admin-dashboard">
                <Button variant="default" size="sm" className="h-8 text-xs gap-1.5">
                  View Attendance Reports
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
          {/* Quick Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Total Employees
                  </p>
                  <p className="text-2xl font-bold mt-1">{stats.total}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Auto-fetched active staff
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Portal Auto-Cron Active
                  </p>
                  <p className="text-2xl font-bold mt-1 text-primary">
                    {stats.scheduled}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Daily auto check-in/out
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Zap className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Marked Present ({selectedDate})
                  </p>
                  <p className="text-2xl font-bold mt-1 text-emerald-600">
                    {stats.present}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Synced with Attendance Report
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <UserCheck className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Not Marked Yet
                  </p>
                  <p className="text-2xl font-bold mt-1 text-amber-600">
                    {stats.notMarked}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Ready to assign location
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <MapPin className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Cron Job & Schedule Automation Panel */}
          <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-background to-background shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Daily Cron Job & Schedule Automation (Portal Employees Only)
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Automatically marks Check-In and Check-Out daily at the configured times exclusively for employees enabled in this{' '}
                    <code className="font-mono font-semibold text-foreground">/locations</code>{' '}
                    portal.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-3.5 py-2 rounded-xl border shadow-sm">
                  <Label
                    htmlFor="master-cron-toggle"
                    className="text-xs font-semibold cursor-pointer"
                  >
                    Daily Automation:
                  </Label>
                  <Switch
                    id="master-cron-toggle"
                    checked={cronEnabled}
                    onCheckedChange={setCronEnabled}
                  />
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      cronEnabled
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {cronEnabled ? 'ACTIVE' : 'OFF'}
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-emerald-600" />
                    Daily Auto Check-In Time
                  </Label>
                  <Input
                    type="time"
                    value={cronCheckInTime}
                    onChange={(e) => setCronCheckInTime(e.target.value)}
                    className="h-9 text-sm font-medium bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-rose-600" />
                    Daily Auto Check-Out Time
                  </Label>
                  <Input
                    type="time"
                    value={cronCheckOutTime}
                    onChange={(e) => setCronCheckOutTime(e.target.value)}
                    className="h-9 text-sm font-medium bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="flex items-center gap-2 lg:col-span-3 flex-wrap">
                  <Button
                    onClick={handleSaveScheduleSettings}
                    disabled={savingSchedule}
                    className="h-9 text-xs font-semibold gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingSchedule ? 'Saving...' : 'Save Daily Schedule'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleRunCronNow('CHECK_IN')}
                    disabled={runningCronPhase !== null}
                    className="h-9 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
                  >
                    <Play className="h-3.5 w-3.5" />
                    {runningCronPhase === 'CHECK_IN'
                      ? 'Running...'
                      : 'Auto Check-In Scheduled Now'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleRunCronNow('CHECK_OUT')}
                    disabled={runningCronPhase !== null}
                    className="h-9 text-xs gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
                  >
                    <Play className="h-3.5 w-3.5" />
                    {runningCronPhase === 'CHECK_OUT'
                      ? 'Running...'
                      : 'Auto Check-Out Scheduled Now'}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => handleRunCronNow('BOTH')}
                    disabled={runningCronPhase !== null}
                    className="h-9 text-xs font-semibold gap-1.5"
                  >
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    {runningCronPhase === 'BOTH'
                      ? 'Applying...'
                      : 'Mark All Scheduled (In & Out)'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table Controls: Target Date, Search, Filter Tabs, and Bulk Apply */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-4 border-b">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Left: Filter Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border w-fit">
                  <button
                    type="button"
                    onClick={() => setViewFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      viewFilter === 'ALL'
                        ? 'bg-white dark:bg-slate-800 text-primary shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All Employees ({stats.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewFilter('SCHEDULED')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      viewFilter === 'SCHEDULED'
                        ? 'bg-white dark:bg-slate-800 text-primary shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Cron Scheduled ({stats.scheduled})
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewFilter('NOT_MARKED')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      viewFilter === 'NOT_MARKED'
                        ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Not Marked ({stats.notMarked})
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewFilter('PRESENT')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      viewFilter === 'PRESENT'
                        ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Marked Present ({stats.present})
                  </button>
                </div>

                {/* Right: Target Date Picker & Auto-Apply Switch */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border">
                    <Switch
                      id="auto-apply-switch"
                      checked={autoApplyOnLocationSelect}
                      onCheckedChange={setAutoApplyOnLocationSelect}
                    />
                    <Label
                      htmlFor="auto-apply-switch"
                      className="text-xs font-medium cursor-pointer"
                    >
                      Auto-apply attendance when Location is set
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="portal-date"
                      className="text-xs font-semibold whitespace-nowrap flex items-center gap-1"
                    >
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      Attendance Date:
                    </Label>
                    <Input
                      id="portal-date"
                      type="date"
                      value={selectedDate}
                      onChange={(e) =>
                        e.target.value && setSelectedDate(e.target.value)
                      }
                      className="h-9 w-[155px] text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Search & Bulk Action Bar */}
              <div className="pt-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by Name, Position, Department, or Location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs sm:text-sm"
                  />
                </div>

                {selectedUserIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 bg-primary/5 border border-primary/20 p-2 rounded-xl">
                    <Badge variant="default" className="text-xs">
                      {selectedUserIds.length} Selected
                    </Badge>
                    <Input
                      placeholder="Bulk Location (e.g. Head Office)"
                      value={bulkLocationName}
                      onChange={(e) => setBulkLocationName(e.target.value)}
                      list="portal-locations-datalist"
                      className="h-8 w-44 text-xs bg-white dark:bg-slate-900"
                    />
                    <Input
                      type="time"
                      value={bulkCheckInTime}
                      onChange={(e) => setBulkCheckInTime(e.target.value)}
                      className="h-8 w-28 text-xs bg-white dark:bg-slate-900"
                      title="Bulk Check-In Time"
                    />
                    <Input
                      type="time"
                      value={bulkCheckOutTime}
                      onChange={(e) => setBulkCheckOutTime(e.target.value)}
                      className="h-8 w-28 text-xs bg-white dark:bg-slate-900"
                      title="Bulk Check-Out Time"
                    />
                    <Button
                      size="sm"
                      onClick={handleBulkApply}
                      disabled={applyingBulk}
                      className="h-8 text-xs font-semibold gap-1"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {applyingBulk
                        ? 'Applying...'
                        : `Apply to ${selectedUserIds.length} Employees`}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            {/* Datalist for Location Autocomplete */}
            <datalist id="portal-locations-datalist">
              {locations.map((loc) => (
                <option key={loc.id} value={loc.name} />
              ))}
            </datalist>

            {/* Main Table: Name | Position | Location | Timestamps & Date | Auto-Cron | Status | Action */}
            <CardContent className="p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Fetching all employees and location records...
                  </p>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="text-center py-14 text-muted-foreground text-sm">
                  No employees found matching your filter.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80 dark:bg-slate-900/60">
                      <TableRow>
                        <TableHead className="w-[42px] text-center">
                          <input
                            type="checkbox"
                            checked={
                              selectedUserIds.length ===
                                filteredEmployees.length &&
                              filteredEmployees.length > 0
                            }
                            onChange={toggleSelectAll}
                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                          />
                        </TableHead>
                        <TableHead className="min-w-[210px] font-bold text-slate-800 dark:text-slate-200">
                          Name
                        </TableHead>
                        <TableHead className="min-w-[150px] font-bold text-slate-800 dark:text-slate-200">
                          Position
                        </TableHead>
                        <TableHead className="min-w-[250px] font-bold text-slate-800 dark:text-slate-200">
                          Location (Editable / Fake Location)
                        </TableHead>
                        <TableHead className="min-w-[230px] font-bold text-slate-800 dark:text-slate-200">
                          Timestamps ({selectedDate})
                        </TableHead>
                        <TableHead className="min-w-[110px] text-center font-bold text-slate-800 dark:text-slate-200">
                          Daily Cron
                        </TableHead>
                        <TableHead className="min-w-[140px] font-bold text-slate-800 dark:text-slate-200">
                          Report Status
                        </TableHead>
                        <TableHead className="text-right min-w-[150px] font-bold text-slate-800 dark:text-slate-200">
                          Apply Attendance
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {filteredEmployees.map((emp) => {
                        const edit = rowEdits[emp.id] || {
                          locationName:
                            emp.effectiveLocationName || 'Head Office',
                          position: emp.position || 'Employee',
                          checkInTime: cronCheckInTime,
                          checkOutTime: cronCheckOutTime,
                          isCustomLocation: false,
                          autoSchedule: emp.isScheduledInPortal,
                        };

                        const hasMarkedAttendance =
                          emp.attendance && emp.attendance.status !== 'ABSENT';
                        const isApplying = applyingUserId === emp.id;
                        const locBadgeColor = getLocationColor(
                          edit.locationName || 'Head Office'
                        );

                        return (
                          <TableRow
                            key={emp.id}
                            className={
                              hasMarkedAttendance
                                ? 'bg-emerald-50/20 dark:bg-emerald-950/10'
                                : ''
                            }
                          >
                            {/* Bulk Checkbox */}
                            <TableCell className="text-center">
                              <input
                                type="checkbox"
                                checked={selectedUserIds.includes(emp.id)}
                                onChange={() => toggleSelectOne(emp.id)}
                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                              />
                            </TableCell>

                            {/* 1. NAME COLUMN */}
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-semibold text-sm text-foreground">
                                  {emp.fullName}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {emp.email}
                                </span>
                                <span className="text-[10px] font-medium text-primary mt-0.5">
                                  {emp.department}
                                </span>
                              </div>
                            </TableCell>

                            {/* 2. POSITION COLUMN */}
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="text-xs sm:text-sm font-medium">
                                  {emp.position || 'Employee'}
                                </span>
                              </div>
                            </TableCell>

                            {/* 3. LOCATION COLUMN (Editable Dropdown + Custom Fake Location Input) */}
                            <TableCell>
                              <div className="space-y-1.5">
                                {!edit.isCustomLocation &&
                                locations.length > 0 ? (
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      value={edit.locationName}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '__CUSTOM__') {
                                          updateRowEdit(emp.id, {
                                            isCustomLocation: true,
                                            locationName: '',
                                          });
                                        } else {
                                          updateRowEdit(emp.id, {
                                            locationName: val,
                                          });
                                          if (autoApplyOnLocationSelect && val) {
                                            handleApplySingleEmployee(
                                              emp,
                                              val,
                                              'BOTH'
                                            );
                                          }
                                        }
                                      }}
                                      className="h-8 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                                    >
                                      <option value="">
                                        -- Select Location --
                                      </option>
                                      {locations.map((loc) => (
                                        <option key={loc.id} value={loc.name}>
                                          {loc.name}
                                        </option>
                                      ))}
                                      <option value="__CUSTOM__">
                                        + Type Custom / Fake Location...
                                      </option>
                                    </select>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        updateRowEdit(emp.id, {
                                          isCustomLocation: true,
                                        })
                                      }
                                      className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                                      title="Type custom fake location name"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <Input
                                      placeholder="Enter fake/custom location..."
                                      value={edit.locationName}
                                      list="portal-locations-datalist"
                                      onChange={(e) =>
                                        updateRowEdit(emp.id, {
                                          locationName: e.target.value,
                                        })
                                      }
                                      onKeyDown={(e) => {
                                        if (
                                          e.key === 'Enter' &&
                                          edit.locationName.trim()
                                        ) {
                                          handleApplySingleEmployee(
                                            emp,
                                            edit.locationName.trim(),
                                            'BOTH'
                                          );
                                        }
                                      }}
                                      className="h-8 text-xs flex-1 bg-white dark:bg-slate-900"
                                    />
                                    {locations.length > 0 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          updateRowEdit(emp.id, {
                                            isCustomLocation: false,
                                            locationName:
                                              edit.locationName ||
                                              locations[0]?.name ||
                                              'Head Office',
                                          })
                                        }
                                        className="h-8 px-2 text-[11px] text-muted-foreground"
                                        title="Switch back to location list"
                                      >
                                        List
                                      </Button>
                                    )}
                                  </div>
                                )}

                                {edit.locationName && (
                                  <div className="flex items-center gap-1">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${locBadgeColor.bg} ${locBadgeColor.text} ${locBadgeColor.border}`}
                                    >
                                      <MapPin className="h-2.5 w-2.5" />
                                      {edit.locationName}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            {/* 4. TIMESTAMPS COLUMN (Check-In & Check-Out Time for Selected Date) */}
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <div className="space-y-0.5">
                                  <span className="text-[10px] text-muted-foreground block">
                                    Check-In
                                  </span>
                                  <Input
                                    type="time"
                                    value={edit.checkInTime}
                                    onChange={(e) =>
                                      updateRowEdit(emp.id, {
                                        checkInTime: e.target.value,
                                      })
                                    }
                                    className="h-8 w-[104px] text-xs px-2 bg-white dark:bg-slate-900"
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-[10px] text-muted-foreground block">
                                    Check-Out
                                  </span>
                                  <Input
                                    type="time"
                                    value={edit.checkOutTime}
                                    onChange={(e) =>
                                      updateRowEdit(emp.id, {
                                        checkOutTime: e.target.value,
                                      })
                                    }
                                    className="h-8 w-[104px] text-xs px-2 bg-white dark:bg-slate-900"
                                  />
                                </div>
                              </div>
                            </TableCell>

                            {/* 5. DAILY AUTO-CRON COLUMN */}
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <Switch
                                  checked={Boolean(edit.autoSchedule)}
                                  disabled={togglingUserId === emp.id}
                                  onCheckedChange={(checked) =>
                                    handleToggleEmployeeCron(emp, checked)
                                  }
                                />
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  {edit.autoSchedule ? 'Scheduled' : 'Manual'}
                                </span>
                              </div>
                            </TableCell>

                            {/* 6. REPORT STATUS COLUMN */}
                            <TableCell>
                              {hasMarkedAttendance ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {emp.attendance?.checkOutTime
                                      ? 'PRESENT (In & Out)'
                                      : 'CHECKED IN'}
                                  </span>
                                  <div className="text-[11px] text-muted-foreground">
                                    {emp.attendance?.checkInTimeHHMM || '--:--'}{' '}
                                    →{' '}
                                    {emp.attendance?.checkOutTimeHHMM ||
                                      'Ongoing'}
                                  </div>
                                </div>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  Not Marked
                                </span>
                              )}
                            </TableCell>

                            {/* 7. ACTION COLUMN */}
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleApplySingleEmployee(
                                      emp,
                                      undefined,
                                      'BOTH'
                                    )
                                  }
                                  disabled={isApplying}
                                  className="h-8 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm gap-1"
                                >
                                  {isApplying ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                  {hasMarkedAttendance ? 'Update' : 'Apply'}
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleApplySingleEmployee(
                                      emp,
                                      undefined,
                                      'CHECK_IN_ONLY'
                                    )
                                  }
                                  disabled={isApplying}
                                  className="h-8 px-2 text-[11px]"
                                  title="Mark Check-In Only"
                                >
                                  In Only
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}

