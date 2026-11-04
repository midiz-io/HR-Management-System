import React, { useState, useEffect, useCallback } from "react";
import { 
  Bell, 
  Send, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Smartphone,
  Mail,
  MessageSquare,
  Loader2,
  RefreshCw,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phoneNumber?: string;
}

export default function NotificationManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [hasTriggeredToday, setHasTriggeredToday] = useState(false);

  // Auto-trigger logic
  useEffect(() => {
    const checkTrigger = () => {
      const now = new Date();
      // Only trigger if it's 8:00 AM and hasn't triggered yet
      if (now.getHours() === 8 && now.getMinutes() === 0 && !hasTriggeredToday) {
        console.log("Auto-triggering daily reminders...");
        handleSendNotifications(false);
        setHasTriggeredToday(true);
      }
      
      // Reset at midnight
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        setHasTriggeredToday(false);
      }
    };
    
    const interval = setInterval(checkTrigger, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [hasTriggeredToday, selectedUserIds]);

  // Countdown timer logic
  const calculateTimeLeft = useCallback(() => {
    const now = new Date();
    const target = new Date();
    target.setHours(8, 0, 0, 0);
    
    if (now > target) {
      target.setDate(target.getDate() + 1);
    }
    
    const diff = target.getTime() - now.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    
    return () => clearInterval(timer);
  }, [calculateTimeLeft]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/user/list'); // Assuming this endpoint exists or I'll create it
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSendNotifications = async (isTest: boolean = false) => {
    if (selectedUserIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No Users Selected",
        description: "Please select at least one user to notify.",
      });
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/notifications/pingram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedUserIds, isTest }),
      });

      if (res.ok) {
        const result = await res.json();
        toast({
          title: "Notifications Sent",
          description: `Successfully sent ${result.successCount} notifications.`,
        });
        if (!isTest) setSelectedUserIds([]);
      } else {
        throw new Error("Failed to send notifications");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setSending(false);
    }
  };

  const filteredUsers = users.filter(u => 
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Timer Card */}
        <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-indigo-500 to-purple-600 text-white md:col-span-1">
          <CardHeader className="pb-2">
            <CardDescription className="text-indigo-100 font-medium">Next Scheduled Notification</CardDescription>
            <CardTitle className="text-4xl font-black font-mono tracking-wider">
              {timeLeft || "00:00:00"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs font-medium text-indigo-100">
              <Clock className="w-3 h-3" />
              <span>Daily Reminder at 8:00 AM</span>
            </div>
          </CardContent>
          <CardFooter className="pt-0">
             <Badge variant="outline" className="bg-white/10 text-white border-white/20">
               Auto-trigger Enabled
             </Badge>
          </CardFooter>
        </Card>

        {/* Channels Summary Card */}
        <Card className="rounded-2xl border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Notification Channels</CardTitle>
            <CardDescription>Multi-channel delivery via Pingram API</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 flex-1 min-w-[150px]">
              <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold">SMS</div>
                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest">Active</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 flex-1 min-w-[150px]">
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold">Email</div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest">Active</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 flex-1 min-w-[150px]">
              <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center text-white">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold">Push</div>
                <div className="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase tracking-widest">Active</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview Card */}
        <Card className="rounded-2xl border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Message Preview</CardTitle>
            <CardDescription className="text-[10px]">What users will receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
             <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] font-bold uppercase text-slate-400">SMS</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">Hello [Name], Reminder: Please mark your attendance today. - AttendX</p>
             </div>
             <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-3 h-3 text-blue-500" />
                  <span className="text-[10px] font-bold uppercase text-slate-400">Email</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">Attendance Reminder</p>
                <p className="text-[10px] text-slate-400 line-clamp-1">Friendly reminder to mark your attendance...</p>
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-sm border-slate-100 dark:border-slate-800 overflow-hidden">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div>
              <CardTitle>Audience Management</CardTitle>
              <CardDescription>Select employees and admins to receive reminders.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Search users..." 
                  className="pl-10 h-9 w-[200px] md:w-[250px] rounded-xl border-slate-200 dark:border-slate-800"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button 
                onClick={() => handleSendNotifications(true)}
                disabled={sending || selectedUserIds.length === 0}
                variant="outline"
                className="rounded-xl gap-2"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Test
              </Button>
              <Button 
                onClick={() => handleSendNotifications(false)}
                disabled={sending || selectedUserIds.length === 0}
                className="rounded-xl gap-2 shadow-lg shadow-primary/20"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Trigger Manual
              </Button>
              <Button 
                variant="outline"
                size="sm"
                className="h-9 rounded-xl border-dashed"
                onClick={() => setSelectedUserIds(users.map(u => u.id))}
              >
                Select Everyone
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/30 dark:bg-slate-900/30 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 w-10">
                    <Checkbox 
                      checked={selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedUserIds(filteredUsers.map(u => u.id));
                        } else {
                          setSelectedUserIds([]);
                        }
                      }}
                    />
                  </th>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Contact Details</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
                        <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading users...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <motion.tr 
                      key={user.id}
                      className={`group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${selectedUserIds.includes(user.id) ? 'bg-primary/5' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <Checkbox 
                          checked={selectedUserIds.includes(user.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedUserIds(prev => [...prev, user.id]);
                            } else {
                              setSelectedUserIds(prev => prev.filter(id => id !== user.id));
                            }
                          }}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-400 text-xs">
                            {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-sm">{user.firstName} {user.lastName}</div>
                            <div className="text-[10px] text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                           <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                             <Mail className="w-3 h-3" />
                             <span>Email</span>
                           </div>
                           <div className={`flex items-center gap-1.5 text-xs ${user.phoneNumber ? 'text-emerald-600 font-medium' : 'text-slate-300'}`}>
                             <MessageSquare className="w-3 h-3" />
                             <span>{user.phoneNumber ? 'SMS Ready' : 'No Phone'}</span>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                           <CheckCircle2 className="w-4 h-4" />
                           Ready
                         </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
