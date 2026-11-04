import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import {
  FaClock,
  FaRobot,
  FaBuilding,
  FaSpinner,
  FaCheckCircle,
  FaTimesCircle,
  FaHourglassHalf,
  FaMapMarkerAlt,
  FaUser,
} from 'react-icons/fa';
import { format, parseISO } from 'date-fns';

interface AutoCheckoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName?: string;
  userRole?: string | null;
}

export const AutoCheckoutDialog: React.FC<AutoCheckoutDialogProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  userRole,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [data, setData] = useState<any>(null);
  const [autoCheckoutEnabled, setAutoCheckoutEnabled] = useState<boolean>(false);
  const [autoCheckoutHours, setAutoCheckoutHours] = useState<string>('8.0');
  const { toast } = useToast();

  const isAdminOrSuperAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

  useEffect(() => {
    if (isOpen && userId) {
      fetchAutoCheckoutData();
    }
  }, [isOpen, userId]);

  const fetchAutoCheckoutData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/users/${userId}/auto-checkout`);
      if (!res.ok) {
        throw new Error('Failed to fetch auto check-out details');
      }
      const json = await res.json();
      setData(json);
      setAutoCheckoutEnabled(json.user?.autoCheckoutEnabled ?? false);
      setAutoCheckoutHours(String(json.user?.autoCheckoutHours ?? '8.0'));
    } catch (error: any) {
      console.error('Error loading auto checkout data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load auto check-out settings',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isAdminOrSuperAdmin) {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'Only Admin and Super Admin can modify Auto Check-Out schedules.',
      });
      return;
    }

    const hours = parseFloat(autoCheckoutHours);
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      toast({
        variant: 'destructive',
        title: 'Invalid Hours',
        description: 'Please enter a valid number of hours between 0.5 and 24.',
      });
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/users/${userId}/auto-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoCheckoutEnabled,
          autoCheckoutHours: hours,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save auto check-out schedule');
      }

      toast({
        title: 'Schedule Updated',
        description: `Auto check-out for ${userName || 'user'} has been ${
          autoCheckoutEnabled ? `enabled (${hours} hours)` : 'disabled'
        }.`,
      });

      onClose();
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update auto check-out schedule',
      });
    } finally {
      setSaving(false);
    }
  };

  const formatTimeStr = (isoString?: string | null) => {
    if (!isoString) return 'N/A';
    try {
      return format(new Date(isoString), 'hh:mm a');
    } catch {
      return 'N/A';
    }
  };

  const formatDateStr = (isoString?: string | null) => {
    if (!isoString) return 'N/A';
    try {
      return format(new Date(isoString), 'dd MMM yyyy');
    } catch {
      return 'N/A';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border-t-4 border-primary p-5 sm:p-6 shadow-2xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-semibold text-lg">
            <FaRobot className="h-5 w-5 text-primary animate-pulse" />
            <DialogTitle>Auto Check-Out Schedule</DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            Configure automated check-out schedule for employee attendance.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <FaSpinner className="animate-spin h-8 w-8 text-primary" />
            <p className="text-sm text-muted-foreground">Loading employee attendance details...</p>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* User Info Header Card */}
            <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                    <FaUser className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm leading-none">
                      {data?.user?.firstName} {data?.user?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{data?.user?.email}</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-primary/10 text-primary border border-primary/20">
                  {data?.user?.role}
                </span>
              </div>

              <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <FaBuilding className="h-3.5 w-3.5 text-slate-400" />
                  <span>Department:</span>
                  <span className="font-medium text-foreground">{data?.user?.department || 'N/A'}</span>
                </div>
                <div>
                  <span>Position: </span>
                  <span className="font-medium text-foreground">{data?.user?.position || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Today's Check-In Status Card */}
            <div className="border rounded-xl p-4 space-y-3 bg-card shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FaClock className="h-3.5 w-3.5 text-primary" /> Today's Check-In Status
                </span>
                {data?.checkInStatus === 'IN_PROGRESS' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse">
                    <FaHourglassHalf className="h-3 w-3" /> In Progress
                  </span>
                )}
                {data?.checkInStatus === 'CHECKED_OUT' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <FaCheckCircle className="h-3 w-3" /> Checked Out
                  </span>
                )}
                {data?.checkInStatus === 'NOT_CHECKED_IN' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <FaTimesCircle className="h-3 w-3" /> Not Checked In
                  </span>
                )}
              </div>

              {data?.checkInStatus === 'IN_PROGRESS' && (
                <div className="space-y-2 pt-1 text-xs">
                  <div className="grid grid-cols-2 gap-2 bg-amber-50/60 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-200/50 dark:border-amber-900/50">
                    <div>
                      <span className="text-muted-foreground block">Check-In Time</span>
                      <span className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
                        {formatTimeStr(data?.attendanceToday?.checkInTime)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Date</span>
                      <span className="font-medium text-foreground">
                        {formatDateStr(data?.attendanceToday?.checkInTime)}
                      </span>
                    </div>
                  </div>

                  {data?.attendanceToday?.locationName && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FaMapMarkerAlt className="h-3 w-3 text-red-500" />
                      <span>Location: </span>
                      <span className="font-medium text-foreground">{data.attendanceToday.locationName}</span>
                    </div>
                  )}

                  {data?.scheduledAutoCheckoutTime && autoCheckoutEnabled && (
                    <div className="bg-primary/5 text-primary border border-primary/20 rounded-lg p-2 text-xs flex items-center justify-between">
                      <span>Scheduled Auto Check-Out:</span>
                      <span className="font-bold">{formatTimeStr(data.scheduledAutoCheckoutTime)}</span>
                    </div>
                  )}
                </div>
              )}

              {data?.checkInStatus === 'CHECKED_OUT' && (
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg text-xs">
                  <div>
                    <span className="text-muted-foreground block">Check-In Time</span>
                    <span className="font-medium">{formatTimeStr(data?.attendanceToday?.checkInTime)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Check-Out Time</span>
                    <span className="font-medium">{formatTimeStr(data?.attendanceToday?.checkOutTime)}</span>
                  </div>
                </div>
              )}

              {data?.checkInStatus === 'NOT_CHECKED_IN' && (
                <p className="text-xs text-muted-foreground italic">
                  Employee has not checked in today yet. Schedule settings will apply automatically once they check in.
                </p>
              )}
            </div>

            {/* Auto Check-Out Schedule Settings */}
            <div className="border rounded-xl p-4 space-y-4 bg-card shadow-sm">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-checkout-switch" className="text-sm font-semibold cursor-pointer">
                    Enable Auto Check-Out
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically check out user after shift hours
                  </p>
                </div>
                <Switch
                  id="auto-checkout-switch"
                  checked={autoCheckoutEnabled}
                  onCheckedChange={setAutoCheckoutEnabled}
                  disabled={!isAdminOrSuperAdmin}
                />
              </div>

              {autoCheckoutEnabled && (
                <div className="space-y-3 pt-2 border-t">
                  <Label htmlFor="checkout-hours" className="text-xs font-semibold text-foreground">
                    Auto Check-Out Duration (Hours after Check-In)
                  </Label>

                  {/* Preset Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {['8.0', '9.0', '10.0', '12.0'].map((preset) => (
                      <Button
                        key={preset}
                        type="button"
                        variant={autoCheckoutHours === preset ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 text-xs px-3"
                        onClick={() => setAutoCheckoutHours(preset)}
                        disabled={!isAdminOrSuperAdmin}
                      >
                        {preset} Hrs
                      </Button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      id="checkout-hours"
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="24"
                      value={autoCheckoutHours}
                      onChange={(e) => setAutoCheckoutHours(e.target.value)}
                      disabled={!isAdminOrSuperAdmin}
                      className="h-9 text-sm"
                      placeholder="e.g. 8.0"
                    />
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Hours</span>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed bg-blue-50/60 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 p-2.5 rounded-lg border border-blue-200/50 dark:border-blue-900/50">
                    💡 <strong>How it works:</strong> System monitors active check-in. If the user doesn't manually check out after{' '}
                    <strong>{autoCheckoutHours || '8'} hours</strong> from check-in, the system automatically checks them out and logs it in attendance & monthly reports.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {isAdminOrSuperAdmin && (
            <Button type="button" onClick={handleSave} disabled={loading || saving} className="gap-2">
              {saving ? (
                <>
                  <FaSpinner className="animate-spin h-4 w-4" /> Saving...
                </>
              ) : (
                <>Save Schedule</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
