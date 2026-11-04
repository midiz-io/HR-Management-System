import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Building2,
  Users,
  Shield,
  Clock,
  RefreshCw,
  Search,
  Sparkles,
  Paperclip,
  CheckCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

interface Department {
  id: string;
  name: string;
  description: string | null;
  head?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  _count?: {
    employees: number;
    messages: number;
  };
}

interface Message {
  id: string;
  departmentId: string;
  senderId: string;
  message: string;
  attachments?: string | null;
  createdAt: string;
  sender: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    role: string;
    position: string | null;
    profileImage?: string | null;
  };
}

interface DepartmentChatBoxProps {
  currentUserId?: string;
}

export default function DepartmentChatBox({ currentUserId }: DepartmentChatBoxProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [loadingDepts, setLoadingDepts] = useState<boolean>(true);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [currentRole, setCurrentRole] = useState<string>('EMPLOYEE');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDeptId) {
      fetchMessages(selectedDeptId);
      // Auto-poll messages every 6 seconds for fresh conversation
      const interval = setInterval(() => {
        fetchMessages(selectedDeptId, true);
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [selectedDeptId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const fetchDepartments = async () => {
    try {
      setLoadingDepts(true);
      const res = await fetch('/api/department-chat');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments || []);
        setIsSuperAdmin(data.isSuperAdmin || false);
        setCurrentRole(data.currentRole || 'EMPLOYEE');

        if (data.departments && data.departments.length > 0) {
          setSelectedDeptId(data.departments[0].id);
        }
      }
    } catch (err: any) {
      console.error('Error fetching chat departments:', err);
    } finally {
      setLoadingDepts(false);
    }
  };

  const fetchMessages = async (deptId: string, isPolling = false) => {
    try {
      if (!isPolling) setLoadingMessages(true);
      const res = await fetch(`/api/department-chat/${deptId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching department messages:', err);
    } finally {
      if (!isPolling) setLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !selectedDeptId) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const res = await fetch('/api/department-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: selectedDeptId,
          message: messageText,
        }),
      });

      if (res.ok) {
        const createdMsg = await res.json();
        setMessages((prev) => [...prev, createdMsg]);
      } else {
        const data = await res.json();
        toast({
          variant: 'destructive',
          title: 'Message Not Sent',
          description: data.error || 'Failed to deliver message',
        });
        setNewMessage(messageText);
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message,
      });
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  const currentDept = departments.find((d) => d.id === selectedDeptId);

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <MessageSquare className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold tracking-tight">Department Chat Box</h2>
            {isSuperAdmin && (
              <Badge className="bg-amber-500 text-slate-950 font-semibold text-xs ml-2">
                HR Global Access
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {isSuperAdmin
              ? 'HR Super Admin: View, monitor, and participate in conversations across all company departments.'
              : `Official communication channel for members and Sectional Head of ${currentDept?.name || 'your department'}.`}
          </p>
        </div>

        {/* Department Switcher for HR / Multi-Department */}
        <div className="flex items-center gap-2">
          {isSuperAdmin && departments.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
              <Building2 className="w-4 h-4 text-slate-400 ml-2" />
              <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                <SelectTrigger className="w-[200px] h-8 text-xs bg-transparent border-0 text-white focus:ring-0">
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-slate-100 border-slate-800">
                  {Array.isArray(departments) && departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => selectedDeptId && fetchMessages(selectedDeptId)}
            className="border-slate-700 hover:bg-slate-800 text-slate-200 text-xs h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingMessages ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Chat Interface */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-md overflow-hidden bg-white dark:bg-slate-900 flex flex-col h-[650px]">
        {/* Department Info Bar */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              {currentDept?.name ? currentDept.name.substring(0, 2).toUpperCase() : 'DP'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {currentDept?.name || 'Department Channel'}
                </h3>
                <Badge variant="outline" className="text-[10px] px-2 py-0 border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300">
                  {messages.length} messages
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                {currentDept?.head ? (
                  <span>Head: {currentDept.head.firstName} {currentDept.head.lastName}</span>
                ) : (
                  <span>Sectional Head: Unassigned</span>
                )}
                {currentDept?._count?.employees !== undefined && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {currentDept._count.employees} Members
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Message Thread Scroll Area */}
        <div
          ref={scrollRef}
          className="flex-1 p-4 md:p-6 overflow-y-auto custom-scrollbar space-y-4 bg-slate-50/30 dark:bg-slate-950/20"
        >
          {loadingMessages && messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <p className="text-xs">Loading department messages...</p>
            </div>
          ) : !Array.isArray(messages) || messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mb-3">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h4 className="font-semibold text-slate-800 dark:text-slate-200">No messages yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Welcome to the {currentDept?.name || 'Department'} chat room. Start the conversation with your team members!
              </p>
            </div>
          ) : (
            Array.isArray(messages) && messages.map((msg) => {
              const isMe = currentUserId ? msg.senderId === currentUserId : false;
              const isHead = msg.sender?.role === 'SECTIONAL_HEAD' || msg.sender?.position?.toLowerCase().includes('head');
              const isHR = msg.sender?.role === 'SUPER_ADMIN' || msg.sender?.role === 'ADMIN';

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Sender Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm ${
                      isHR
                        ? 'bg-amber-600 text-white'
                        : isHead
                        ? 'bg-blue-600 text-white'
                        : isMe
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {msg.sender?.firstName ? msg.sender.firstName[0].toUpperCase() : 'U'}
                  </div>

                  {/* Message Bubble */}
                  <div className={`max-w-[75%] sm:max-w-[65%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {isMe ? 'You' : `${msg.sender?.firstName || ''} ${msg.sender?.lastName || ''}`.trim() || msg.sender?.email}
                      </span>
                      {isHR ? (
                        <Badge className="text-[9px] px-1 py-0 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300">
                          HR Admin
                        </Badge>
                      ) : isHead ? (
                        <Badge className="text-[9px] px-1 py-0 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300">
                          Sectional Head
                        </Badge>
                      ) : null}
                    </div>

                    <div
                      className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm break-words whitespace-pre-wrap ${
                        isMe
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700/60 rounded-tl-none'
                      }`}
                    >
                      {msg.message}
                    </div>

                    <span className="text-[10px] text-slate-400 mt-1 px-1 flex items-center gap-1">
                      {format(new Date(msg.createdAt), 'hh:mm a')}
                      {isMe && <CheckCheck className="w-3 h-3 text-indigo-400" />}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Message ${currentDept?.name || 'department'}...`}
              disabled={sending || !selectedDeptId}
              className="flex-1 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-xs sm:text-sm h-11 focus-visible:ring-indigo-500 rounded-xl"
            />
            <Button
              type="submit"
              disabled={sending || !newMessage.trim() || !selectedDeptId}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-11 px-4 rounded-xl shadow-md transition-all shrink-0"
            >
              <Send className="w-4 h-4 mr-1.5" />
              <span>Send</span>
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
