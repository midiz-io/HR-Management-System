import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Trash2, RotateCcw, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function TrashRecycleBin() {
  const { toast } = useToast();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchTrash();
  }, []);

  const fetchTrash = async () => {
    try {
      const res = await fetch('/api/trash');
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      }
    } catch (error) {
      console.error('Error fetching trash:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        toast({ title: 'Restored Successfully', description: 'The record has been moved back to its original location.' });
        setRecords((prev) => prev.filter((r) => r.id !== id));
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to restore');
      }
    } catch (error: any) {
      toast({ title: 'Restore Failed', description: error.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this? This action cannot be undone.')) return;
    
    setActionLoading(id + '-del');
    try {
      const res = await fetch(`/api/trash?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Permanently Deleted' });
        setRecords((prev) => prev.filter((r) => r.id !== id));
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error: any) {
      toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const emptyTrash = async () => {
    if (!confirm('Are you sure you want to empty the trash? ALL records here will be permanently deleted.')) return;
    
    setActionLoading('all');
    try {
      const res = await fetch(`/api/trash?id=all`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Trash Emptied' });
        setRecords([]);
      }
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <Card className="border-red-100 dark:border-red-900 shadow-md">
      <CardHeader className="bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="w-5 h-5" /> 
              System Recycle Bin
            </CardTitle>
            <CardDescription className="text-red-600/80 dark:text-red-400/80 mt-1">
              Data deleted from the system is kept here before permanent removal. You can restore it if it was deleted by mistake.
            </CardDescription>
          </div>
          {records.length > 0 && (
            <Button variant="destructive" onClick={emptyTrash} disabled={actionLoading === 'all'} className="gap-2">
              {actionLoading === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Empty Trash
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Trash2 className="h-12 w-12 opacity-20 mb-4" />
            <p>The recycle bin is empty.</p>
          </div>
        ) : (
          <div className="divide-y">
            {records.map((record) => (
              <div key={record.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                <div className="flex flex-col gap-1 overflow-hidden pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                      {record.tableName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Deleted {format(new Date(record.deletedAt), 'MMM dd, yyyy h:mm a')}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground truncate opacity-70">
                    {JSON.stringify(record.recordData).substring(0, 150)}...
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleRestore(record.id)}
                    disabled={!!actionLoading}
                    className="gap-1 border-green-200 text-green-700 hover:bg-green-50 dark:border-green-900 dark:text-green-400 dark:hover:bg-green-950/30"
                  >
                    {actionLoading === record.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    Restore
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDelete(record.id)}
                    disabled={!!actionLoading}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    {actionLoading === record.id + '-del' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
