import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  Bell,
  PlusCircle,
  Image as ImageIcon,
  Calendar,
  Building2,
  Trash2,
  RefreshCw,
  Search,
  Eye,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  Send,
  X,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';

const safeFormatDate = (dateVal: any, formatPattern: string, fallback = '') => {
  if (!dateVal) return fallback;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return fallback;
    return format(d, formatPattern);
  } catch {
    return fallback;
  }
};

interface NoticeItem {
  id: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  authorId: string;
  authorName?: string | null;
  authorRole?: string | null;
  isActive: boolean;
  expiresAt?: string | null;
  createdAt: string;
  isRead?: boolean;
}

interface DepartmentOption {
  id: string;
  name: string;
}

export default function NoticeManagement() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<string>('board');
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [managedNotices, setManagedNotices] = useState<NoticeItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [isPublisher, setIsPublisher] = useState<boolean>(false);
  const [isSuperAdminOrHR, setIsSuperAdminOrHR] = useState<boolean>(false);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [managedDepartment, setManagedDepartment] = useState<{ id: string; name: string } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // New Notice Form State
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('ALL');
  const [priority, setPriority] = useState<'NORMAL' | 'IMPORTANT' | 'URGENT'>('NORMAL');
  const [expiresAt, setExpiresAt] = useState<string>('');

  // View Notice Dialog State
  const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);

  useEffect(() => {
    fetchFeedNotices();
  }, []);

  const fetchFeedNotices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notices');
      if (res.ok) {
        const data = await res.json();
        setNotices(Array.isArray(data?.notices) ? data.notices : []);
        setIsPublisher(data.isPublisher || false);
        setIsSuperAdminOrHR(data.isSuperAdminOrHR || false);
        setUserDepartment(data.userDepartment || null);
        if (data.departments && Array.isArray(data.departments)) {
          setDepartments(data.departments);
        }
      }
    } catch (err) {
      console.error('Error fetching notices:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchManagedNotices = async () => {
    try {
      const res = await fetch('/api/notices?manage=true');
      if (res.ok) {
        const data = await res.json();
        setManagedNotices(Array.isArray(data?.notices) ? data.notices : []);
        if (data.departments && Array.isArray(data.departments)) {
          setDepartments(data.departments);
        }
        if (data.managedDepartment) {
          setManagedDepartment(data.managedDepartment);
          setSelectedDeptId(data.managedDepartment.id);
        }
      }
    } catch (err) {
      console.error('Error fetching managed notices:', err);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'manage') {
      fetchManagedNotices();
    } else if (tab === 'board') {
      fetchFeedNotices();
    }
  };

  const handlePublishNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast({
        title: 'Missing Fields',
        description: 'Please provide both notice title and description',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      let deptName = 'All Departments (Company-Wide)';
      if (selectedDeptId !== 'ALL') {
        const found = departments.find(d => d.id === selectedDeptId);
        deptName = found ? found.name : (managedDepartment?.name || 'Department');
      }

      const payload = {
        title: title.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim() || null,
        departmentId: selectedDeptId,
        departmentName: deptName,
        priority,
        expiresAt: expiresAt || null,
      };

      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to publish notice');
      }

      toast({
        title: 'Notice Published! 📢',
        description: `Successfully broadcast to ${deptName}. Employees will see it on login.`,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setImageUrl('');
      setPriority('NORMAL');
      setExpiresAt('');

      // Refresh list and switch to feed
      fetchFeedNotices();
      setActiveTab('board');
    } catch (err: any) {
      toast({
        title: 'Publish Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNotice = async (noticeId: string) => {
    if (!confirm('Are you sure you want to delete this notice? It will no longer appear for employees.')) {
      return;
    }

    try {
      const res = await fetch(`/api/notices/${noticeId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete notice');
      }

      toast({
        title: 'Notice Deleted',
        description: 'The notice has been removed permanently.',
      });

      setManagedNotices(prev => prev.filter(n => n.id !== noticeId));
      setNotices(prev => prev.filter(n => n.id !== noticeId));
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Filter feed notices
  const filteredNotices = notices.filter(n => {
    if (!n) return false;
    const matchesPriority = priorityFilter === 'ALL' || n.priority === priorityFilter;
    const s = (searchTerm || '').trim().toLowerCase();
    if (!s) return matchesPriority;
    const matchesSearch = 
      (n.title && n.title.toLowerCase().includes(s)) ||
      (n.description && n.description.toLowerCase().includes(s)) ||
      (n.departmentName && n.departmentName.toLowerCase().includes(s)) ||
      (n.authorName && n.authorName.toLowerCase().includes(s));
    return Boolean(matchesPriority && matchesSearch);
  });

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900/90 via-slate-900 to-indigo-950 p-6 rounded-2xl text-white shadow-xl border border-indigo-800/40">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge className="bg-indigo-500/30 text-indigo-200 border-indigo-400/40 text-[10px] font-black tracking-widest uppercase">
              Official Bulletins
            </Badge>
            {userDepartment && (
              <Badge variant="outline" className="text-white/80 border-white/20 text-[10px]">
                {userDepartment}
              </Badge>
            )}
          </div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <Bell className="text-indigo-400 w-6 h-6 animate-pulse" />
            Department Notice Board
          </h2>
          <p className="text-xs text-indigo-200/80 mt-1 max-w-xl">
            Company-wide and department announcements, official memos, and urgent updates with image attachments.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchFeedNotices}
            className="border-white/20 text-white bg-white/5 hover:bg-white/10 text-xs h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {isPublisher && (
            <Button
              size="sm"
              onClick={() => handleTabChange('publish')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md h-9 gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              Publish Notice
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <TabsTrigger value="board" className="text-xs font-bold px-4 py-2">
            <Bell className="w-3.5 h-3.5 mr-1.5" /> Notice Board Feed
          </TabsTrigger>
          {isPublisher && (
            <>
              <TabsTrigger value="publish" className="text-xs font-bold px-4 py-2">
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Publish New Notice
              </TabsTrigger>
              <TabsTrigger value="manage" className="text-xs font-bold px-4 py-2">
                <Building2 className="w-3.5 h-3.5 mr-1.5" /> Manage Published
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* ======================================================== */}
        {/* TAB 1: NOTICE BOARD FEED                                 */}
        {/* ======================================================== */}
        <TabsContent value="board" className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search notices by title, content, author..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-muted-foreground uppercase text-[10px]">Priority:</span>
              <div className="flex items-center gap-1">
                {['ALL', 'URGENT', 'IMPORTANT', 'NORMAL'].map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={priorityFilter === p ? 'default' : 'ghost'}
                    onClick={() => setPriorityFilter(p)}
                    className={`h-7 px-2.5 text-[11px] font-bold rounded-lg ${
                      priorityFilter === p 
                        ? p === 'URGENT' ? 'bg-rose-600 text-white' : p === 'IMPORTANT' ? 'bg-amber-600 text-white' : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                        : ''
                    }`}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Feed Grid */}
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
              <p className="text-xs text-muted-foreground">Loading department notices...</p>
            </div>
          ) : filteredNotices.length === 0 ? (
            <Card className="p-12 text-center border-dashed border-2">
              <Bell className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h3 className="font-bold text-slate-700 dark:text-slate-300">No active notices found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                There are no published announcements matching your department or filter criteria at the moment.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredNotices.map((notice) => {
                const isUrgent = notice.priority === 'URGENT';
                const isImportant = notice.priority === 'IMPORTANT';

                return (
                  <Card
                    key={notice.id}
                    onClick={() => setSelectedNotice(notice)}
                    className="group cursor-pointer hover:shadow-xl transition-all duration-300 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 overflow-hidden flex flex-col bg-white dark:bg-slate-900"
                  >
                    {/* Notice Attached Image Thumbnail */}
                    {notice.imageUrl ? (
                      <div className="h-44 w-full bg-slate-100 dark:bg-slate-950 overflow-hidden relative border-b border-slate-100 dark:border-slate-800">
                        <img
                          src={notice.imageUrl}
                          alt={notice.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute top-2.5 right-2.5">
                          <Badge
                            className={`font-black text-[10px] shadow-md uppercase tracking-wider ${
                              isUrgent 
                                ? 'bg-rose-600 text-white animate-pulse' 
                                : isImportant 
                                ? 'bg-amber-600 text-white' 
                                : 'bg-slate-900/80 backdrop-blur-md text-white'
                            }`}
                          >
                            {notice.priority}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <div className={`p-4 border-b flex items-center justify-between ${
                        isUrgent 
                          ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900' 
                          : isImportant 
                          ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900' 
                          : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'
                      }`}>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                            {notice.departmentName || 'Company-Wide'}
                          </span>
                        </div>
                        <Badge
                          className={`font-bold text-[10px] ${
                            isUrgent 
                              ? 'bg-rose-600 text-white' 
                              : isImportant 
                              ? 'bg-amber-600 text-white' 
                              : 'bg-indigo-600 text-white'
                          }`}
                        >
                          {notice.priority}
                        </Badge>
                      </div>
                    )}

                    <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        {notice.imageUrl && (
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-1">
                            <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="truncate">{notice.departmentName || 'Company-Wide'}</span>
                          </div>
                        )}
                        <h4 className="font-black text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                          {notice.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
                          {notice.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="truncate font-semibold text-slate-600 dark:text-slate-400 max-w-[150px]">
                          {notice.authorName || 'Management'}
                        </span>
                        <span>
                          {safeFormatDate(notice.createdAt, 'MMM dd, yyyy', 'Recent')}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 2: PUBLISH NEW NOTICE                                */}
        {/* ======================================================== */}
        {isPublisher && (
          <TabsContent value="publish">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Input Column */}
              <div className="lg:col-span-2">
                <Card className="border-slate-200 dark:border-slate-800 shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg font-black flex items-center gap-2">
                      <Send className="w-5 h-5 text-indigo-600" /> Broadcast New Department Notice
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Notices are automatically displayed as a popup banner for employees upon logging into their portal.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handlePublishNotice} className="space-y-4">
                      {/* Title */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Notice Title *</Label>
                        <Input
                          placeholder="e.g. Mandatory Team Meeting Tomorrow at 10 AM / Safety Protocol Update"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          required
                          className="text-sm font-semibold"
                        />
                      </div>

                      {/* Target Department & Priority */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold">Target Department *</Label>
                          {isSuperAdminOrHR ? (
                            <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                              <SelectTrigger className="text-xs">
                                <SelectValue placeholder="Choose Department" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ALL">All Departments (Company-Wide)</SelectItem>
                                {Array.isArray(departments) && departments.filter(d => d && d.id).map((d) => (
                                  <SelectItem key={d.id} value={String(d.id)}>
                                    {d.name || 'Department'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border text-xs font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                              <Building2 className="w-4 h-4" />
                              {managedDepartment?.name || 'Your Assigned Department'} (Locked)
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold">Urgency / Priority *</Label>
                          <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                            <SelectTrigger className="text-xs font-bold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NORMAL">Normal (Standard Bulletin)</SelectItem>
                              <SelectItem value="IMPORTANT">Important (Highlighted)</SelectItem>
                              <SelectItem value="URGENT">Urgent (Red Alert Banner)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Image URL / Attachment */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                            Notice Poster / Banner Image URL (Optional)
                          </span>
                          <span className="text-[10px] text-muted-foreground font-normal">Supports jpg, png, webp link</span>
                        </Label>
                        <Input
                          placeholder="https://example.com/images/announcement.jpg or image hosting link"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          className="text-xs"
                        />
                      </div>

                      {/* Description */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Notice Description / Announcement Content *</Label>
                        <Textarea
                          placeholder="Type full notice details, instructions, venue, time, guidelines..."
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows={6}
                          required
                          className="text-xs leading-relaxed"
                        />
                      </div>

                      {/* Expiration Date (Optional) */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Expiration Date (Optional)</Label>
                        <Input
                          type="date"
                          value={expiresAt}
                          onChange={(e) => setExpiresAt(e.target.value)}
                          className="text-xs max-w-xs"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm h-11 shadow-lg shadow-indigo-600/25 mt-2"
                      >
                        {submitting ? (
                          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Publish & Broadcast to Department
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Live Preview Column */}
              <div>
                <div className="sticky top-20 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                      Mobile & Desktop Preview
                    </span>
                  </div>

                  <Card className="border-2 border-indigo-200 dark:border-indigo-900/60 overflow-hidden shadow-lg bg-white dark:bg-slate-900">
                    {imageUrl ? (
                      <div className="h-48 w-full bg-slate-100 overflow-hidden relative">
                        <img
                          src={imageUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute top-2 right-2">
                          <Badge className="font-bold text-[10px] uppercase">{priority}</Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border-b flex items-center justify-between text-xs">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">Department Notice</span>
                        <Badge className="font-bold text-[10px] uppercase">{priority}</Badge>
                      </div>
                    )}

                    <div className="p-4 space-y-2">
                      <h4 className="font-black text-base text-slate-900 dark:text-white">
                        {title || 'Notice Title Will Appear Here'}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {description || 'Notice description and announcement guidelines will be rendered here clearly for all employees.'}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Preview Mode</span>
                      <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold pointer-events-none">
                        Close (X)
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </TabsContent>
        )}

        {/* ======================================================== */}
        {/* TAB 3: MANAGE PUBLISHED NOTICES                           */}
        {/* ======================================================== */}
        {isPublisher && (
          <TabsContent value="manage">
            <Card className="border-slate-200 dark:border-slate-800 shadow-md">
              <CardHeader className="border-b">
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" /> Published Notices Management
                </CardTitle>
                <CardDescription className="text-xs">
                  Review and delete notices published for your department or company-wide.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {managedNotices.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground text-xs font-semibold">
                    No notices published yet. Use the "Publish New Notice" tab to create one.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {managedNotices.map((n) => (
                      <div key={n.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        <div className="space-y-1 max-w-xl">
                          <div className="flex items-center gap-2">
                            <Badge className={`text-[10px] font-bold ${
                              n.priority === 'URGENT' ? 'bg-rose-600' : n.priority === 'IMPORTANT' ? 'bg-amber-600' : 'bg-slate-800'
                            }`}>
                              {n.priority}
                            </Badge>
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                              {n.departmentName || 'Company-Wide'}
                            </span>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span className="text-[11px] text-muted-foreground">
                              {safeFormatDate(n.createdAt, 'MMM dd, yyyy')}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">{n.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2">{n.description}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedNotice(n)}
                            className="h-8 text-xs font-bold"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> View
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteNotice(n.id)}
                            className="h-8 text-xs font-bold"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Detail Viewer Modal */}
      <Dialog open={!!selectedNotice} onOpenChange={(open) => !open && setSelectedNotice(null)}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedNotice?.title || 'Notice Details'}</DialogTitle>
            <DialogDescription>{selectedNotice?.description || 'Announcement'}</DialogDescription>
          </DialogHeader>
          {selectedNotice && (
            <div>
              {/* Header with Close */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-600 text-white text-[10px] uppercase font-bold">
                    {selectedNotice.priority || 'NORMAL'}
                  </Badge>
                  <span className="text-xs font-bold text-slate-300">
                    {selectedNotice.departmentName || 'Company-Wide'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNotice(null)}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
                {selectedNotice.imageUrl && (
                  <div className="rounded-xl overflow-hidden border max-h-72 bg-slate-950 flex items-center justify-center">
                    <img
                      src={selectedNotice.imageUrl}
                      alt={selectedNotice.title || 'Notice Image'}
                      className="w-full h-full object-cover max-h-72"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    {selectedNotice.title || 'Notice Announcement'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                    <span>By {selectedNotice.authorName || 'Management'}</span>
                    <span>•</span>
                    <span>{safeFormatDate(selectedNotice.createdAt, 'PPP p', 'Recent')}</span>
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedNotice.description || ''}
                </div>
              </div>

              <div className="p-4 border-t bg-slate-50 dark:bg-slate-900 flex justify-end">
                <Button size="sm" onClick={() => setSelectedNotice(null)} className="text-xs font-bold">
                  Close Notice
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
