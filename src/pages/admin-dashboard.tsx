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
import DashboardOverview from "@/components/DashboardOverview";
import NoticePopupModal from "@/components/NoticePopupModal";
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
  Utensils,
  Banknote,
  DoorOpen,
  Timer,
  QrCode,
  UserMinus,
  Settings,
  BookOpen,
  CalendarCheck,
  MessageSquare,
  Bell,
  Fish,
  FolderCheck,
  ExternalLink
} from "lucide-react";
import { motion } from "framer-motion";

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

// Lazy-loaded heavy admin modules so initial dashboard load is instant
const AttendanceCheckInOut = dynamic(() => import("@/components/AttendanceCheckInOut"), { loading: () => <TabSectionSkeleton /> });
const LocationManagement = dynamic(() => import("@/components/LocationManagement"), { loading: () => <TabSectionSkeleton /> });
const UserProfile = dynamic(() => import("@/components/UserProfile"), { loading: () => <TabSectionSkeleton /> });
const UserManagement = dynamic(() => import("@/components/UserManagement"), { loading: () => <TabSectionSkeleton /> });
const AttendanceReports = dynamic(() => import("@/components/AttendanceReports"), { loading: () => <TabSectionSkeleton /> });
const GateQRScanner = dynamic(() => import("@/components/GateQRScanner"), { loading: () => <TabSectionSkeleton /> });
const AdminLeaveManagement = dynamic(() => import("@/components/AdminLeaveManagement"), { loading: () => <TabSectionSkeleton /> });
const WorkShiftManagement = dynamic(() => import("@/components/WorkShiftManagement"), { loading: () => <TabSectionSkeleton /> });
const RosterManagement = dynamic(() => import("@/components/RosterManagement"), { loading: () => <TabSectionSkeleton /> });
const BulkRosterManagement = dynamic(() => import("@/components/BulkRosterManagement"), { loading: () => <TabSectionSkeleton /> });
const TaskManagement = dynamic(() => import("@/components/TaskManagement"), { loading: () => <TabSectionSkeleton /> });
const LeaveManagement = dynamic(() => import("@/components/LeaveManagement"), { loading: () => <TabSectionSkeleton /> });
const FoodOrderManagement = dynamic(() => import("@/components/FoodOrderManagement"), { loading: () => <TabSectionSkeleton /> });
const AdminOTManagement = dynamic(() => import("@/components/AdminOTManagement"), { loading: () => <TabSectionSkeleton /> });
const AdminSalaryAdvance = dynamic(() => import("@/components/AdminSalaryAdvance"), { loading: () => <TabSectionSkeleton /> });
const AdminGatePass = dynamic(() => import("@/components/AdminGatePass"), { loading: () => <TabSectionSkeleton /> });
const AdminShortLeave = dynamic(() => import("@/components/AdminShortLeave"), { loading: () => <TabSectionSkeleton /> });
const SystemSettings = dynamic(() => import("@/components/SystemSettings"), { loading: () => <TabSectionSkeleton /> });
const AdminDocumentManagement = dynamic(() => import("@/components/AdminDocumentManagement"), { loading: () => <TabSectionSkeleton /> });
const EmployeePersonalFilesPortal = dynamic(() => import("@/components/EmployeePersonalFilesPortal"), { loading: () => <TabSectionSkeleton /> });
const DatabaseBackup = dynamic(() => import("@/components/DatabaseBackup"), { loading: () => <TabSectionSkeleton /> });
const ResignedEmployees = dynamic(() => import("@/components/ResignedEmployees"), { loading: () => <TabSectionSkeleton /> });
const OffDayManagement = dynamic(() => import("@/components/OffDayManagement"), { loading: () => <TabSectionSkeleton /> });
const DepartmentChatBox = dynamic(() => import("@/components/DepartmentChatBox"), { loading: () => <TabSectionSkeleton /> });
const PendingBillsManagement = dynamic(() => import("@/components/PendingBillsManagement"), { loading: () => <TabSectionSkeleton /> });
const NoticeManagement = dynamic(() => import("@/components/NoticeManagement"), { loading: () => <TabSectionSkeleton /> });

export default function AdminDashboard() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<string>("ADMIN");
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isHRUnlocked, setIsHRUnlocked] = useState<boolean>(false);
  const [isPasscodeDialogOpen, setIsPasscodeDialogOpen] = useState<boolean>(false);
  const [passcodeValue, setPasscodeValue] = useState<string>("");
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const isSectionalHead = userRole === "SECTIONAL_HEAD";

  // Sectional Head navigation items (scoped exclusively to their departmental and personal operations)
  const sectionalHeadNavItems = useMemo(() => [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, protected: false },
    { id: 'attendance', label: 'My Attendance', icon: Clock, protected: false },
    { id: 'my-leave', label: 'My Leave', icon: Calendar, protected: false },
    { id: 'profile', label: 'My Profile', icon: UserCircle, protected: false },
    { id: 'department-chat', label: 'Department Chat', icon: MessageSquare, protected: false },
    { id: 'notices', label: 'Department Notices', icon: Bell, protected: false },
    { id: 'pending-bills', label: 'Pending Bills', icon: Fish, protected: false },
    { id: 'employee-files', label: 'Employee Personal Files', icon: FolderCheck, protected: false, externalUrl: 'https://dutch-trails-employee-files.vercel.app/' },
    { type: 'separator', label: 'Department Supervision' },
    { id: 'leave', label: 'Leave Recommendations', icon: CalendarDays, protected: false },
    { id: 'off-day', label: 'Off-Day Recommendations', icon: CalendarCheck, protected: false },
    { id: 'gate-pass', label: 'Gate Passes & Returns', icon: DoorOpen, protected: false },
    { id: 'tasks', label: 'Department Tasks', icon: CheckSquare, protected: false },
    { id: 'reports', label: 'Attendance Reports', icon: FileBarChart, protected: false },
    { id: 'ot', label: 'OT Requests', icon: Clock, protected: false },
    { id: 'short-leave', label: 'Short Leaves', icon: Timer, protected: false },
  ], []);

  // Full Admin navigation items
  const adminNavItems = useMemo(() => [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, protected: false },
    { id: 'attendance', label: 'My Attendance', icon: Clock, protected: false },
    { id: 'my-leave', label: 'My Leave', icon: Calendar, protected: false },
    { id: 'profile', label: 'Profile', icon: UserCircle, protected: false },
    { type: 'separator', label: 'Administration' },
    { id: 'employee-files', label: 'Employee Personal Files', icon: FolderCheck, protected: false, externalUrl: 'https://dutch-trails-employee-files.vercel.app/' },
    { id: 'company-documents', label: 'Company Policies', icon: BookOpen, protected: true },
    { id: 'users', label: 'User Management', icon: Users, protected: true },
    { id: 'resigned-employees', label: 'Resigned Employees', icon: UserMinus, protected: true },
    { id: 'locations', label: 'Work Locations', icon: MapPin, protected: true },
    { id: 'leave', label: 'Employee Leaves', icon: CalendarDays, protected: false },
    { id: 'off-day', label: 'Off-Day Approvals', icon: CalendarCheck, protected: true },
    { id: 'reports', label: 'Reports', icon: FileBarChart, protected: true },
    { id: 'gate-scanner', label: 'Gate QR Scanner', icon: QrCode, protected: true },
    { id: 'work-shifts', label: 'Work Shifts', icon: Clock, protected: true },
    { id: 'roster', label: 'Roster', icon: CalendarDays, protected: true },
    { id: 'bulk-roster', label: 'Bulk Roster', icon: Users, protected: true },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, protected: true },
    { id: 'department-chat', label: 'Department Chat', icon: MessageSquare, protected: false },
    { id: 'notices', label: 'Department Notices', icon: Bell, protected: false },
    { id: 'ot', label: 'OT Requests', icon: Clock, protected: false },
    { id: 'food-orders', label: 'Food Orders', icon: Utensils, protected: false },
    { id: 'gate-pass', label: 'Gate Passes', icon: DoorOpen, protected: true },
    { id: 'short-leave', label: 'Short Leaves', icon: Timer, protected: true },
    { id: 'salary-advance', label: 'Salary Advances', icon: Banknote, protected: true },
    { id: 'pending-bills', label: 'Pending Bills', icon: Fish, protected: true },
    { id: 'backup', label: 'Database Backup', icon: Database, protected: true },
    { id: 'settings', label: 'System Settings', icon: Settings, protected: true },
  ], []);

  const navItems = isSectionalHead ? sectionalHeadNavItems : adminNavItems;

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
        description: "The passcode entered is incorrect. Please try again.",
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

            if (userData.role === "SUPER_ADMIN") {
              router.push("/super-admin-dashboard");
              return;
            }

            if (userData.role !== "ADMIN" && userData.role !== "SECTIONAL_HEAD") {
              router.push("/dashboard");
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
          <p className="text-muted-foreground font-medium animate-pulse">Initializing AttendX Dashboard...</p>
        </div>
      </div>
    );
  }

  const NavItem = ({ item }: { item: any }) => {
    if (item.type === 'separator') {
      return (
        <div className={`px-4 py-2 mt-4 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 select-none transition-all duration-200 ${isSidebarCollapsed ? 'opacity-0 h-0 overflow-hidden py-0 mt-0 mb-0' : 'opacity-100'}`}>
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
        className={`w-full flex items-center justify-between px-4 py-2.5 my-0.5 rounded-xl transition-colors duration-150 group relative
          ${isActive 
            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' 
            : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground'
          } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
      >
        <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center w-full' : ''}`}>
          {Icon ? (
            <Icon className={`h-5 w-5 shrink-0 transition-transform duration-150 ${isActive ? 'scale-110' : 'group-hover:scale-110'} ${isSidebarCollapsed ? 'mx-auto' : ''}`} />
          ) : (
            <div className="w-5 h-5 shrink-0" />
          )}
          <span className={`font-medium text-sm tracking-tight transition-all duration-200 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
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
      <aside className={`hidden lg:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 sticky top-0 h-screen transition-all duration-200 z-40 ${isSidebarCollapsed ? 'w-20 px-2' : 'w-72 px-4'}`}>
        <div className={`flex items-center pt-6 pb-4 relative shrink-0 ${isSidebarCollapsed ? 'justify-center px-0' : 'px-3 gap-3'}`}>
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-inner flex-shrink-0">
            <LayoutDashboard className="text-primary-foreground w-6 h-6" />
          </div>
          <div className={`transition-all duration-200 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">AttendX</h1>
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest leading-none">Management</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className={`absolute -right-2 top-1/2 -translate-y-1/2 rounded-full w-6 h-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm z-50 text-muted-foreground hover:text-primary ${isSidebarCollapsed ? 'right-0 -mr-3' : ''}`}
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
            title={isSidebarCollapsed ? "Sign Out" : undefined}
            className={`w-full justify-start rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 transition-all border-slate-200 dark:border-slate-800 ${isSidebarCollapsed ? 'px-0 justify-center' : 'gap-3'}`}
            onClick={signOut}
          >
            <LogOut className="h-4 w-4 text-red-500" />
            <span className={`transition-all duration-200 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>Sign Out</span>
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
                <Button variant="ghost" size="icon" className="rounded-xl border border-slate-100 dark:border-slate-800">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full">
                <SheetHeader className="p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
                  <SheetTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                      <LayoutDashboard className="text-primary-foreground w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <span className="text-xl font-bold block">AttendX</span>
                      <span className="text-[10px] text-primary font-bold uppercase tracking-widest">Management</span>
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <div className="px-4 py-2 space-y-1 flex-1 overflow-y-auto custom-scrollbar pb-6">
                  {navItems.map((item, idx) => (
                    <NavItem key={item.id || idx} item={item} />
                  ))}
                </div>
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                  <Button variant="outline" className="w-full justify-start gap-2 rounded-xl border-slate-200 dark:border-slate-800" onClick={signOut}>
                    <LogOut className="h-4 w-4 text-red-500" />
                    <span>Sign Out</span>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <span className="font-bold text-lg tracking-tight">Dashboard</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary">
              {userName?.charAt(0) || 'U'}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 xl:p-10 custom-scrollbar min-w-0">
          <Tabs value={activeTab} className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                   <div className="w-2 h-8 bg-primary rounded-full hidden md:block" />
                   <h2 className="text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100">
                    {navItems.find(i => i.id === activeTab)?.label}
                   </h2>
                </div>
                <p className="text-sm text-muted-foreground font-medium pl-0 md:pl-4">
                  Admin <span className="text-primary">/</span> {navItems.find(i => i.id === activeTab)?.label}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <span className="px-3 text-xs font-bold text-muted-foreground">Quick Actions</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border-emerald-200 dark:border-emerald-800 transition-all shadow-sm"
                  onClick={() => window.open('https://dutch-trails-employee-files.vercel.app/', '_blank', 'noopener,noreferrer')}
                  title="Open Employee Personal Files (New Tab)"
                >
                  <FolderCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline">Employee Files</span>
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={() => handleTabChange('attendance')} title="Check In/Out">
                  <Clock className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50" onClick={signOut} title="Sign Out">
                  <LogOut className="h-4 w-4" />
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

              {activeTab === "gate-scanner" && (
                <TabsContent value="gate-scanner" className="mt-0 focus-visible:outline-none">
                  <GateQRScanner />
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

              {activeTab === "bulk-roster" && (
                <TabsContent value="bulk-roster" className="mt-0 focus-visible:outline-none">
                  <BulkRosterManagement />
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

              {activeTab === "ot" && (
                <TabsContent value="ot" className="mt-0 focus-visible:outline-none">
                  <AdminOTManagement />
                </TabsContent>
              )}

              {activeTab === "gate-pass" && (
                <TabsContent value="gate-pass" className="mt-0 focus-visible:outline-none">
                  <AdminGatePass />
                </TabsContent>
              )}

              {activeTab === "short-leave" && (
                <TabsContent value="short-leave" className="mt-0 focus-visible:outline-none">
                  <AdminShortLeave />
                </TabsContent>
              )}

              {activeTab === "salary-advance" && (
                <TabsContent value="salary-advance" className="mt-0 focus-visible:outline-none">
                  <AdminSalaryAdvance />
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

        {/* Passcode Entry Dialog */}
        <Dialog open={isPasscodeDialogOpen} onOpenChange={setIsPasscodeDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Administrative Access</DialogTitle>
              <DialogDescription>
                Please enter the HR passcode to access this section.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePasscodeSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="passcode">Passcode</Label>
                <Input
                  id="passcode"
                  type="password"
                  value={passcodeValue}
                  onChange={(e) => setPasscodeValue(e.target.value)}
                  placeholder="Enter passcode"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPasscodeDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Unlock Access
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
