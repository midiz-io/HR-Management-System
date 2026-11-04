import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle, 
  Calendar, 
  UserCircle 
} from 'lucide-react';
import { format } from 'date-fns';

interface Notice {
  id: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  priority?: 'NORMAL' | 'IMPORTANT' | 'URGENT' | string;
  authorName?: string | null;
  authorRole?: string | null;
  createdAt?: string | Date | null;
}

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

export default function NoticePopupModal() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isDismissing, setIsDismissing] = useState<boolean>(false);

  useEffect(() => {
    fetchUnreadNotices();
  }, []);

  const fetchUnreadNotices = async () => {
    try {
      const res = await fetch('/api/notices?unreadOnly=true');
      if (res.ok) {
        const data = await res.json();
        const unreadList: Notice[] = Array.isArray(data?.notices) ? data.notices : [];

        // Check against localStorage to avoid showing in same browser session if already dismissed
        let sessionDismissed: string[] = [];
        try {
          if (typeof window !== 'undefined') {
            const raw = localStorage.getItem('dismissed_notices_cache');
            if (raw) sessionDismissed = JSON.parse(raw);
            if (!Array.isArray(sessionDismissed)) sessionDismissed = [];
          }
        } catch {
          sessionDismissed = [];
        }

        const filtered = unreadList.filter(n => n && n.id && !sessionDismissed.includes(n.id));

        if (filtered.length > 0) {
          setNotices(filtered);
          setCurrentIndex(0);
          setIsOpen(true);
        }
      }
    } catch (err) {
      console.error('Error fetching unread department notices:', err);
    }
  };

  const handleDismissCurrent = async (markAsRead = true) => {
    if (!notices || notices.length === 0 || !notices[currentIndex]) {
      setIsOpen(false);
      return;
    }
    const currentNotice = notices[currentIndex];

    // Store in localStorage cache immediately
    try {
      if (typeof window !== 'undefined' && currentNotice?.id) {
        let sessionDismissed: string[] = [];
        const raw = localStorage.getItem('dismissed_notices_cache');
        if (raw) sessionDismissed = JSON.parse(raw);
        if (!Array.isArray(sessionDismissed)) sessionDismissed = [];
        if (!sessionDismissed.includes(currentNotice.id)) {
          sessionDismissed.push(currentNotice.id);
          localStorage.setItem('dismissed_notices_cache', JSON.stringify(sessionDismissed));
        }
      }
    } catch {
      // Ignore
    }

    if (markAsRead && currentNotice?.id) {
      setIsDismissing(true);
      try {
        await fetch('/api/notices/dismiss', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ noticeId: currentNotice.id }),
        });
      } catch (e) {
        console.error('Error marking notice as read:', e);
      } finally {
        setIsDismissing(false);
      }
    }

    // Advance to next or close
    if (currentIndex < notices.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsOpen(false);
    }
  };

  const handleDismissAll = async () => {
    const ids = notices.map(n => n?.id).filter(Boolean);
    try {
      if (typeof window !== 'undefined') {
        let sessionDismissed: string[] = [];
        const raw = localStorage.getItem('dismissed_notices_cache');
        if (raw) sessionDismissed = JSON.parse(raw);
        if (!Array.isArray(sessionDismissed)) sessionDismissed = [];
        localStorage.setItem('dismissed_notices_cache', JSON.stringify([...new Set([...sessionDismissed, ...ids])]));
      }
    } catch {
      // Ignore
    }

    try {
      await fetch('/api/notices/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noticeIds: ids }),
      });
    } catch {
      // Ignore
    }

    setIsOpen(false);
  };

  if (!isOpen || !Array.isArray(notices) || notices.length === 0 || !notices[currentIndex]) {
    return null;
  }

  const notice = notices[currentIndex];
  if (!notice) return null;

  const priority = notice.priority || 'NORMAL';
  const isUrgent = priority === 'URGENT';
  const isImportant = priority === 'IMPORTANT';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && setIsOpen(false)}>
      <DialogContent className="max-w-xl w-[94vw] sm:w-full p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 z-50">
        <DialogHeader className="sr-only">
          <DialogTitle>{notice.title || 'Department Notice'}</DialogTitle>
          <DialogDescription>{notice.description || 'Notice Announcement'}</DialogDescription>
        </DialogHeader>

        {/* Top Header Bar with Prominent Close Icon */}
        <div className={`p-4 flex items-center justify-between border-b ${
          isUrgent 
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900' 
            : isImportant 
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900' 
            : 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shadow-sm ${
              isUrgent ? 'bg-rose-600 text-white animate-pulse' : isImportant ? 'bg-amber-600 text-white' : 'bg-indigo-600 text-white'
            }`}>
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider block text-slate-500 dark:text-slate-400">
                Department Notice
              </span>
              <div className="flex items-center gap-2">
                <Badge variant={isUrgent ? 'destructive' : 'outline'} className="text-[10px] font-bold px-1.5 py-0 h-4">
                  {priority}
                </Badge>
                {notice.departmentName && (
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">
                    {notice.departmentName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {notices.length > 1 && (
              <span className="text-[11px] font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                {currentIndex + 1} of {notices.length}
              </span>
            )}
            {/* Top Close Icon Button */}
            <button
              type="button"
              onClick={() => handleDismissCurrent(false)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Close notice"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Optional Attached Notice Image */}
          {notice.imageUrl && (
            <div className="w-full rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex items-center justify-center max-h-72 shadow-sm">
              <img
                src={notice.imageUrl}
                alt={notice.title || 'Notice Image'}
                className="w-full h-full object-cover max-h-72 transition-transform duration-300 hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Title & Metadata */}
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
              {notice.title || 'Notice Announcement'}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <UserCircle className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <strong className="text-slate-700 dark:text-slate-200">{notice.authorName || 'Management'}</strong>
                {notice.authorRole && <span className="opacity-75">({notice.authorRole})</span>}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {safeFormatDate(notice.createdAt, 'MMM dd, yyyy • h:mm a', 'Recent')}
              </span>
            </div>
          </div>

          {/* Description Content */}
          <div className="bg-slate-50/80 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans">
            {notice.description || 'No description provided.'}
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {notices.length > 1 && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  className="h-9 px-3 text-xs font-bold"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentIndex >= notices.length - 1}
                  onClick={() => setCurrentIndex(prev => Math.min(notices.length - 1, prev + 1))}
                  className="h-9 px-3 text-xs font-bold"
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </>
            )}
            {notices.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismissAll}
                className="text-xs text-muted-foreground hover:text-slate-900 dark:hover:text-white ml-auto sm:ml-0"
              >
                Dismiss All ({notices.length})
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              size="sm"
              variant="default"
              disabled={isDismissing}
              onClick={() => handleDismissCurrent(true)}
              className="w-full sm:w-auto h-9 px-5 font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
              {currentIndex < notices.length - 1 ? 'Next Notice' : 'I Understand & Close'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
