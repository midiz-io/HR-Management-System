import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { 
  Menu, 
  LayoutDashboard, 
  Users, 
  MapPin, 
  Calendar, 
  FileBarChart, 
  Clock, 
  CalendarDays, 
  CheckSquare, 
  Database, 
  UserCircle,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Utensils,
  Wallet,
  Building,
  Bell,
  DoorOpen,
  Briefcase,
  UserMinus,
  Settings,
  BookOpen,
  CalendarCheck,
  MessageSquare,
  Fish,
  FolderCheck,
  ExternalLink
} from "lucide-react";
import { motion } from "framer-motion";
import DashboardOverview from "@/components/DashboardOverview";
import NoticePopupModal from "@/components/NoticePopupModal";

const TabSectionSkeleton = () => (
  <div className="w-full space-y-4 py-4 animate-pulse">
    <div className="h-28 rounded-2xl bg-slate-200/70 dark:bg-slate-800/60 w-full" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="h-32 rounded-2xl bg-slate-200/60 dark:bg-slate-800/50" />
      <div className="h-32 rounded-2xl bg-slate-200/60 dark:bg-slate-800/50" />
      <div className="h-32 rounded-2xl bg-slate-200/60 dark:bg-slate-800/50" />
    </div>
    <div className="h-64 rounded-2xl bg-slate-200/50 dark:bg-slate-800/40 w-full" />
  </div>
);

// Lazy-loaded heavy modules for fast initial load and instant tab switching
const AttendanceCheckInOut = dynamic(() => import("@/components/AttendanceCheckInOut"), { loading: () => <TabSectionSkeleton /> });
const LocationManagement = dynamic(() => import("@/components/LocationManagement"), { loading: () => <TabSectionSkeleton /> });
const UserProfile = dynamic(() => import("@/components/UserProfile"), { loading: () => <TabSectionSkeleton /> });
const UserManagement = dynamic(() => import("@/components/UserManagement"), { loading: () => <TabSectionSkeleton /> });
const AttendanceReports = dynamic(() => import("@/components/AttendanceReports"), { loading: () => <TabSectionSkeleton /> });
const AdminLeaveManagement = dynamic(() => import("@/components/AdminLeaveManagement"), { loading: () => <TabSectionSkeleton /> });
const WorkShiftManagement = dynamic(() => import("@/components/WorkShiftManagement"), { loading: () => <TabSectionSkeleton /> });
const RosterManagement = dynamic(() => import("@/components/RosterManagement"), { loading: () => <TabSectionSkeleton /> });
const TaskManagement = dynamic(() => import("@/components/TaskManagement"), { loading: () => <TabSectionSkeleton /> });
const LeaveManagement = dynamic(() => import("@/components/LeaveManagement"), { loading: () => <TabSectionSkeleton /> });
const DatabaseBackup = dynamic(() => import("@/components/DatabaseBackup"), { loading: () => <TabSectionSkeleton /> });
const FoodOrderManagement = dynamic(() => import("@/components/FoodOrderManagement"), { loading: () => <TabSectionSkeleton /> });
const PayrollManagement = dynamic(() => import("@/components/PayrollManagement"), { loading: () => <TabSectionSkeleton /> });
const DepartmentManagement = dynamic(() => import("@/components/DepartmentManagement"), { loading: () => <TabSectionSkeleton /> });
const AdminOTManagement = dynamic(() => import("@/components/AdminOTManagement"), { loading: () => <TabSectionSkeleton /> });
const NotificationManagement = dynamic(() => import("@/components/NotificationManagement"), { loading: () => <TabSectionSkeleton /> });
const AdminGatePass = dynamic(() => import("@/components/AdminGatePass"), { loading: () => <TabSectionSkeleton /> });
const CompanyCategorization = dynamic(() => import("@/components/CompanyCategorization"), { loading: () => <TabSectionSkeleton /> });
const SystemSettings = dynamic(() => import("@/components/SystemSettings"), { loading: () => <TabSectionSkeleton /> });
const ResignedEmployees = dynamic(() => import("@/components/ResignedEmployees"), { loading: () => <TabSectionSkeleton /> });
const AdminDocumentManagement = dynamic(() => import("@/components/AdminDocumentManagement"), { loading: () => <TabSectionSkeleton /> });
const EmployeePersonalFilesPortal = dynamic(() => import("@/components/EmployeePersonalFilesPortal"), { loading: () => <TabSectionSkeleton /> });
const OffDayManagement = dynamic(() => import("@/components/OffDayManagement"), { loading: () => <TabSectionSkeleton /> });
const DepartmentChatBox = dynamic(() => import("@/components/DepartmentChatBox"), { loading: () => <TabSectionSkeleton /> });
const PendingBillsManagement = dynamic(() => import("@/components/PendingBillsManagement"), { loading: () => <TabSectionSkeleton /> });
const NoticeManagement = dynamic(() => import("@/components/NoticeManagement"), { loading: () => <TabSectionSkeleton /> });

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<string>("SUPER_ADMIN");
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isHRUnlocked, setIsHRUnlocked] = useState<boolean>(false);
  const [isPasscodeDialogOpen, setIsPasscodeDialogOpen] = useState<boolean>(false);
  const [passcodeValue, setPasscodeValue] = useState<string>("");
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Navigation Items
  const navItems = useMemo(() => [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, protected: false },
    { id: 'attendance', label: 'My Attendance', icon: Clock, protected: false },
    { id: 'my-leave', label: 'My Leave', icon: Calendar, protected: false },
    { id: 'profile', label: 'My Profile', icon: UserCircle, protected: false },
    { type: 'separator', label: 'Global Administration' },
    { id: 'employee-files', label: 'Employee Personal Files', icon: FolderCheck, protected: false, externalUrl: 'https://dutch-trails-employee-files.vercel.app/' },
    { id: 'company-documents', label: 'Company Policies', icon: BookOpen, protected: true },
    { id: 'users', label: 'Global Users', icon: Users, protected: true },
    { id: 'resigned-employees', label: 'Resigned Employees', icon: UserMinus, protected: true },
    { id: 'locations', label: 'Work Locations', icon: MapPin, protected: true },
    { id: 'leave', label: 'Company Leaves', icon: CalendarDays, protected: false },
    { id: 'off-day', label: 'Off-Day Approvals', icon: CalendarCheck, protected: true },
    { id: 'reports', label: 'Analytics Reports', icon: FileBarChart, protected: true },
    { id: 'work-shifts', label: 'Work Shifts', icon: Clock, protected: true },
    { id: 'roster', label: 'Roster Management', icon: CalendarDays, protected: true },
    { id: 'tasks', label: 'Task Management', icon: CheckSquare, protected: true },
    { id: 'department-chat', label: 'Department Chats', icon: MessageSquare, protected: false },
    { id: 'notices', label: 'Department Notices', icon: Bell, protected: false },
    { id: 'food-orders', label: 'Food Orders', icon: Utensils, protected: false },
    { id: 'departments', label: 'Departments', icon: Building, protected: true },
    { id: 'gate-pass', label: 'Gate Passes', icon: DoorOpen, protected: true },
    { id: 'payroll', label: 'Payroll & Salary', icon: Wallet, protected: true },
    { id: 'pending-bills', label: 'Pending Bills & Seafood', icon: Fish, protected: true },
    { id: 'companies', label: 'Company Profiles', icon: Briefcase, protected: true },
    { id: 'notifications', label: 'Notifications', icon: Bell, protected: true },
    { id: 'backup', label: 'System Backup', icon: Database, protected: true },
    { id: 'settings', label: 'System Settings', icon: Settings, protected: true },
  ], []);

  const handleTabChange = useCallback((value: string) => {
    const item = navItems.find(i => i.id === value);
    if (item?.externalUrl) {
      window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
      setActiveTab(value);
      setIsMobileMenuOpen(false);
      return;
    }
    if (item?.protected && !isHRUnlocked) {
      setPendingTab(value);
      setIsPasscodeDialogOpen(true);
      setPasscodeValue("");
    } else {
      setActiveTab(value);
    }
    setIsMobileMenuOpen(false);
  }, [navItems, isHRUnlocked]);

  const handlePasscodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (passcodeValue === "HR") {
      setIsHRUnlocked(true);
      if (pendingTab) setActiveTab(pendingTab);
      setIsPasscodeDialogOpen(false);
      setPendingTab(null);
    } else {
      toast({
        variant: "destructive",
        title: "Invalid Passcode",
        description: "Operation failed. Please enter the correct HR passcode.",
      });
      setPasscodeValue("");
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const response = await fetch(`/api/user`, {
            headers: {
              'Authorization': user.id
            }
          });

          if (response.ok) {
            const userData = await response.json();

            if (userData.role !== "SUPER_ADMIN") {
              router.push(userData.role === "ADMIN" ? "/admin-dashboard" : "/dashboard");
              return;
            }

            setUserRole(userData.role);
            setUserName(userData.firstName ? `${userData.firstName} ${userData.lastName || ''}` : user.email || '');
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchUserData();
  }, [user, router]);

  if (loading) {
     return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 px-4">
        <div className="flex flex-col items-center">
          <div className="w-11 h-11 border-4 border-primary/30 border-t-primary rounded-full mb-4 animate-spin" />
          <p className="text-muted-foreground font-medium animate-pulse text-sm uppercase tracking-widest">Loading Master Console...</p>
        </div>
      </div>
    );
  }

  const NavItem = ({ item }: { item: any }) => {
    if (item.type === 'separator') {
      return (
        <div className={`px-5 py-3 mt-6 mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 select-none border-l-2 border-primary/20 bg-primary/5 rounded-r-lg transition-all duration-200 ${isSidebarCollapsed ? 'opacity-0 h-0 overflow-hidden py-0 mt-0 mb-0 border-l-0' : 'opacity-100'}`}>
          {item.label}
        </div>
      );
    }

    const isActive = activeTab === item.id;
    const Icon = item.icon;

    return (
      <button
        onClick={() => handleTabChange(item.id)}
        title={isSidebarCollapsed ? item.label : undefined}
        className={`w-full flex items-center justify-between px-4 py-3 my-1 rounded-xl transition-colors duration-150 group relative
          ${isActive 
            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' 
            : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground'
          } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
      >
        <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center w-full' : ''}`}>
          {Icon ? (
            <Icon className={`h-5 w-5 shrink-0 transition-transform duration-150 ${isActive ? 'scale-110' : 'group-hover:scale-110'} ${isSidebarCollapsed ? 'mx-auto' : ''}`} />
          ) : (
            <div className="h-5 w-5 shrink-0" />
          )}
          <span className={`font-bold text-sm tracking-tight transition-all duration-200 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
            {item.label}
          </span>
        </div>
        {item.externalUrl && !isSidebarCollapsed ? (
          <ExternalLink className="h-3.5 w-3.5 text-emerald-500/80 group-hover:text-emerald-600 transition-colors shrink-0" />
        ) : (
          isActive && !isSidebarCollapsed && (
            <ChevronRight className="h-4 w-4 opacity-50" />
          )
        )}
      </button>
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-primary/20">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 sticky top-0 h-screen transition-all duration-200 z-40 ${isSidebarCollapsed ? 'w-20 px-2' : 'w-72 px-5'}`}>
        <div className={`flex items-center pt-6 pb-4 relative shrink-0 ${isSidebarCollapsed ? 'justify-center px-0' : 'px-2 gap-3'}`}>
          <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/20 flex-shrink-0">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <div className={`transition-all duration-200 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
            <h1 className="text-xl font-black tracking-tighter text-slate-800 dark:text-slate-100">SUPER PANEL</h1>
            <p className="text-[10px] text-red-600 font-black uppercase tracking-widest leading-none">AttendX Central</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className={`absolute -right-4 top-1/2 -translate-y-1/2 rounded-full w-6 h-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm z-50 text-muted-foreground hover:text-primary ${isSidebarCollapsed ? 'right-0 -mr-2' : ''}`}
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          >
            <ChevronRight className={`h-3 w-3 transition-transform duration-200 ${isSidebarCollapsed ? '' : 'rotate-180'}`} />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar py-2 pr-1">
          {navItems.map((item, idx) => (
            <NavItem key={item.id || idx} item={item} />
          ))}
        </nav>

        <div className="mt-auto pt-4 pb-6 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <Button
            variant="outline"
            title={isSidebarCollapsed ? "System Logout" : undefined}
            className={`w-full justify-start rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 transition-all border-slate-200 dark:border-slate-800 h-12 ${isSidebarCollapsed ? 'px-0 justify-center' : 'gap-4'}`}
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4 text-red-600" />
            <span className={`font-bold transition-all duration-200 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>SYSTEM LOGOUT</span>
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Navbar */}
        <header className="lg:hidden h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-4 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full">
                <SheetHeader className="p-6 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-red-50/10">
                  <SheetTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center">
                      <ShieldCheck className="text-white w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <span className="text-xl font-black block tracking-tighter">SUPER PANEL</span>
                      <span className="text-[10px] text-red-600 font-black uppercase tracking-widest">AttendX Central</span>
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <div className="px-4 py-2 space-y-1 flex-1 overflow-y-auto custom-scrollbar pb-6">
                  {navItems.map((item, idx) => (
                    <NavItem key={item.id || idx} item={item} />
                  ))}
                </div>
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                  <Button variant="outline" className="w-full justify-start gap-4 rounded-xl border-slate-200 dark:border-slate-800 h-12" onClick={() => signOut()}>
                    <LogOut className="h-4 w-4 text-red-600" />
                    <span className="font-bold">SYSTEM LOGOUT</span>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <span className="font-black text-lg tracking-tight uppercase">Master Console</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white shadow-md">
              {userName?.charAt(0) || 'S'}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-10 custom-scrollbar min-w-0">
          <Tabs value={activeTab} className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                   <div className="w-2 h-10 bg-red-600 rounded-full hidden md:block" />
                   <h2 className="text-4xl font-black tracking-tight text-slate-800 dark:text-slate-100">
                    {navItems.find(i => i.id === activeTab)?.label}
                   </h2>
                </div>
                <p className="text-sm text-muted-foreground font-bold pl-0 md:pl-5 uppercase tracking-widest">
                  Master Control <span className="text-red-600 mx-1">/</span> {navItems.find(i => i.id === activeTab)?.label}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <span className="px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 border-r border-slate-100 dark:border-slate-800 mr-2">Quick Commands</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border-emerald-200 dark:border-emerald-800 transition-all shadow-sm"
                  onClick={() => window.open('https://dutch-trails-employee-files.vercel.app/', '_blank', 'noopener,noreferrer')}
                  title="Open Employee Personal Files (New Tab)"
                >
                  <FolderCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline">Employee Files</span>
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </Button>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors" onClick={() => handleTabChange('reports')} title="Reports">
                  <FileBarChart className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors" onClick={() => handleTabChange('backup')} title="Backup">
                  <Database className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <motion.div
               key={activeTab}
               initial={{ opacity: 0, y: 6 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.15, ease: "easeOut" }}
               className="will-change-transform"
            >
              {activeTab === "overview" && (
                <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
                  <DashboardOverview />
                </TabsContent>
              )}

              {activeTab === "users" && (
                <TabsContent value="users" className="mt-0 focus-visible:outline-none">
                  <UserManagement />
                </TabsContent>
              )}

              {activeTab === "locations" && (
                <TabsContent value="locations" className="mt-0 focus-visible:outline-none">
                  <LocationManagement />
                </TabsContent>
              )}

              {activeTab === "leave" && (
                <TabsContent value="leave" className="mt-0 focus-visible:outline-none">
                  <AdminLeaveManagement />
                </TabsContent>
              )}

              {activeTab === "off-day" && (
                <TabsContent value="off-day" className="mt-0 focus-visible:outline-none">
                  <OffDayManagement />
                </TabsContent>
              )}

              {activeTab === "my-leave" && (
                <TabsContent value="my-leave" className="mt-0 focus-visible:outline-none">
                  <LeaveManagement />
                </TabsContent>
              )}

              {activeTab === "resigned-employees" && (
                <TabsContent value="resigned-employees" className="mt-0 focus-visible:outline-none">
                  <ResignedEmployees />
                </TabsContent>
              )}

              {activeTab === "reports" && (
                <TabsContent value="reports" className="mt-0 focus-visible:outline-none">
                  <AttendanceReports />
                </TabsContent>
              )}

              {activeTab === "attendance" && (
                <TabsContent value="attendance" className="mt-0 focus-visible:outline-none">
                  <AttendanceCheckInOut />
                </TabsContent>
              )}

              {activeTab === "work-shifts" && (
                <TabsContent value="work-shifts" className="mt-0 focus-visible:outline-none">
                  <WorkShiftManagement />
                </TabsContent>
              )}

              {activeTab === "roster" && (
                <TabsContent value="roster" className="mt-0 focus-visible:outline-none">
                  <RosterManagement />
                </TabsContent>
              )}

              {activeTab === "tasks" && (
                <TabsContent value="tasks" className="mt-0 focus-visible:outline-none">
                  <TaskManagement />
                </TabsContent>
              )}

              {activeTab === "department-chat" && (
                <TabsContent value="department-chat" className="mt-0 focus-visible:outline-none">
                  <DepartmentChatBox />
                </TabsContent>
              )}

              {activeTab === "backup" && (
                <TabsContent value="backup" className="mt-0 focus-visible:outline-none">
                  <DatabaseBackup />
                </TabsContent>
              )}

              {activeTab === "food-orders" && (
                <TabsContent value="food-orders" className="mt-0 focus-visible:outline-none">
                  <FoodOrderManagement />
                </TabsContent>
              )}

              {activeTab === "payroll" && (
                <TabsContent value="payroll" className="mt-0 focus-visible:outline-none">
                  <PayrollManagement />
                </TabsContent>
              )}

              {activeTab === "pending-bills" && (
                <TabsContent value="pending-bills" className="mt-0 focus-visible:outline-none">
                  <PendingBillsManagement />
                </TabsContent>
              )}

              {activeTab === "notices" && (
                <TabsContent value="notices" className="mt-0 focus-visible:outline-none">
                  <NoticeManagement />
                </TabsContent>
              )}

              {activeTab === "companies" && (
                <TabsContent value="companies" className="mt-0 focus-visible:outline-none">
                  <CompanyCategorization />
                </TabsContent>
              )}

              {activeTab === "departments" && (
                <TabsContent value="departments" className="mt-0 focus-visible:outline-none">
                  <DepartmentManagement />
                </TabsContent>
              )}

              {activeTab === "gate-pass" && (
                <TabsContent value="gate-pass" className="mt-0 focus-visible:outline-none">
                  <AdminGatePass />
                </TabsContent>
              )}

              {activeTab === "ot" && (
                <TabsContent value="ot" className="mt-0 focus-visible:outline-none">
                  <AdminOTManagement />
                </TabsContent>
              )}

              {activeTab === "notifications" && (
                <TabsContent value="notifications" className="mt-0 focus-visible:outline-none">
                  <NotificationManagement />
                </TabsContent>
              )}

              {activeTab === "profile" && (
                <TabsContent value="profile" className="mt-0 focus-visible:outline-none">
                  <UserProfile />
                </TabsContent>
              )}

              {activeTab === "settings" && (
                <TabsContent value="settings" className="mt-0 focus-visible:outline-none">
                  <SystemSettings />
                </TabsContent>
              )}

              {activeTab === "company-documents" && (
                <TabsContent value="company-documents" className="mt-0 focus-visible:outline-none">
                  <AdminDocumentManagement />
                </TabsContent>
              )}

              {activeTab === "employee-files" && (
                <TabsContent value="employee-files" className="mt-0 focus-visible:outline-none">
                  <EmployeePersonalFilesPortal userRole={userRole} />
                </TabsContent>
              )}
            </motion.div>
          </Tabs>
        </main>

        <Dialog open={isPasscodeDialogOpen} onOpenChange={setIsPasscodeDialogOpen}>
          <DialogContent className="sm:max-w-md border-t-4 border-red-600">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-red-600" />
                Administrative Authorization
              </DialogTitle>
              <DialogDescription>
                This action requires elevated permissions. Please enter the master security passcode.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePasscodeSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="passcode" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Master Passcode</Label>
                <Input
                  id="passcode"
                  type="password"
                  value={passcodeValue}
                  onChange={(e) => setPasscodeValue(e.target.value)}
                  placeholder="••••"
                  autoFocus
                  className="rounded-xl h-12 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-red-600 text-center text-2xl tracking-[1em]"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPasscodeDialogOpen(false)} className="rounded-xl">
                  DISMISS
                </Button>
                <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-500/20 px-8">
                  AUTHORIZE
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <NoticePopupModal />
      <Toaster />
    </div>
  );
}
