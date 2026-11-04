import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, Clock } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import TrashRecycleBin from '@/components/TrashRecycleBin';

export default function SystemSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    CRON_TIME_ABSENCES: '20:00',
    CRON_TIME_EXPIRED_REJECT: '23:30',
    CRON_TIME_TASK_REMINDER: '08:00',
    CRON_TIME_LATE_PROCESSOR: '21:00',
    CRON_TIME_CANTEEN: '09:30',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings((prev) => ({ ...prev, ...data }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load system settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Settings saved successfully',
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save system settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">System Settings</h2>
        <p className="text-muted-foreground">
          Configure automated cron job schedules and general system preferences.
        </p>
      </div>
      
      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> 
            Automation Schedule Times
          </CardTitle>
          <CardDescription>
            Set the exact execution times (in 24-hour HH:MM format) for daily automated background tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          
          <div className="space-y-2">
            <Label htmlFor="absences">Auto-Mark Absences Time</Label>
            <Input 
              id="absences" 
              type="time"
              value={settings.CRON_TIME_ABSENCES || '20:00'} 
              onChange={(e) => handleChange('CRON_TIME_ABSENCES', e.target.value)} 
            />
            <p className="text-xs text-muted-foreground">Time to mark missing attendances as ABSENT.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expired">Auto-Reject Expired Requests</Label>
            <Input 
              id="expired" 
              type="time"
              value={settings.CRON_TIME_EXPIRED_REJECT || '23:30'} 
              onChange={(e) => handleChange('CRON_TIME_EXPIRED_REJECT', e.target.value)} 
            />
            <p className="text-xs text-muted-foreground">Time to automatically reject expired Leave/OT/Gate requests.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tasks">Task Reminders Time</Label>
            <Input 
              id="tasks" 
              type="time"
              value={settings.CRON_TIME_TASK_REMINDER || '08:00'} 
              onChange={(e) => handleChange('CRON_TIME_TASK_REMINDER', e.target.value)} 
            />
            <p className="text-xs text-muted-foreground">Time to send notifications for upcoming and overdue tasks.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="late">Late Attendance Processor</Label>
            <Input 
              id="late" 
              type="time"
              value={settings.CRON_TIME_LATE_PROCESSOR || '21:00'} 
              onChange={(e) => handleChange('CRON_TIME_LATE_PROCESSOR', e.target.value)} 
            />
            <p className="text-xs text-muted-foreground">Time to process late warnings and deductions.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="canteen">Daily Canteen Summary Time</Label>
            <Input 
              id="canteen" 
              type="time"
              value={settings.CRON_TIME_CANTEEN || '09:30'} 
              onChange={(e) => handleChange('CRON_TIME_CANTEEN', e.target.value)} 
            />
            <p className="text-xs text-muted-foreground">Time to send the aggregated food order summary.</p>
          </div>

        </CardContent>
        <CardFooter className="bg-slate-50 dark:bg-slate-900 border-t py-4">
          <Button onClick={handleSave} disabled={saving} className="ml-auto flex items-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </Button>
        </CardFooter>
      </Card>

      <Separator className="my-8" />
      
      <TrashRecycleBin />
    </div>
  );
}
