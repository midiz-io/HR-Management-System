import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
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
  Clock, 
  Calendar, 
  CheckSquare, 
  UserCircle,
  LogOut,
  ChevronRight,
  Utensils,
  Wallet,
  Banknote,
  DoorOpen,
  Timer,
  BookOpen,
  CalendarCheck,
  MessageSquare,
  Bell,
  Fish
} from "lucide-react";
import { motion } from "framer-motion";
import AttendanceCheckInOut from "@/components/AttendanceCheckInOut";
import EmployeeDailySalaryBanner from "@/components/EmployeeDailySalaryBanner";
import MandatoryPolicyModal from "@/components/MandatoryPolicyModal";
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

// Lazy-loaded tab modules for fast initial page load & smooth tab transitions
const UserProfile = dynamic(() => import("@/components/UserProfile"), { loading: () => <TabSectionSkeleton /> });
const LeaveManagement = dynamic(() => import("@/components/LeaveManagement"), { loading: () => <TabSectionSkeleton /> });
const EmployeeTaskDashboard = dynamic(() => import("@/components/EmployeeTaskDashboard"), { loading: () => <TabSectionSkeleton /> });
const FoodOrderManagement = dynamic(() => import("@/components/FoodOrderManagement"), { loading: () => <TabSectionSkeleton /> });
const EmployeePayslips = dynamic(() => import("@/components/EmployeePayslips"), { loading: () => <TabSectionSkeleton /> });
const OTManagement = dynamic(() => import("@/components/OTManagement"), { loading: () => <TabSectionSkeleton /> });
const SalaryAdvanceManagement = dynamic(() => import("@/components/SalaryAdvanceManagement"), { loading: () => <TabSectionSkeleton /> });
const GatePassManagement = dynamic(() => import("@/components/GatePassManagement"), { loading: () => <TabSectionSkeleton /> });
const ShortLeaveManagement = dynamic(() => import("@/components/ShortLeaveManagement"), { loading: () => <TabSectionSkeleton /> });
const EmployeeDocuments = dynamic(() => import("@/components/EmployeeDocuments"), { loading: () => <TabSectionSkeleton /> });
const OffDayManagement = dynamic(() => import("@/components/OffDayManagement"), { loading: () => <TabSectionSkeleton /> });
const DepartmentChatBox = dynamic(() => import("@/components/DepartmentChatBox"), { loading: () => <TabSectionSkeleton /> });
const PendingBillsManagement = dynamic(() => import("@/components/PendingBillsManagement"), { loading: () => <TabSectionSkeleton /> });
const NoticeManagement = dynamic(() => import("@/components/NoticeManagement"), { loading: () => <TabSectionSkeleton /> });

export default function Dashboard() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [userRole, setUserRole] = useState<string>("EMPLOYEE");
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>("attendance");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [pendingMandatoryDocs, setPendingMandatoryDocs] = useState<any[]>([]);
  const [isMandatoryModalOpen, setIsMandatoryModalOpen] = useState<boolean>(false);

  // Navigation Items for Employees
  const navItems = useMemo(() => [
    { id: 'attendance', label: 'My Attendance', icon: Clock },
    { id: 'documents', label: 'Company Policies', icon: BookOpen },
    { id: 'leave', label: 'My Leave Requests', icon: Calendar },
    { id: 'off-day', label: 'Off-Day Requests', icon: CalendarCheck },
    { id: 'tasks', label: 'My Tasks', icon: CheckSquare },
    { id: 'department-chat', label: 'Department Chat', icon: MessageSquare },
    { id: 'notices', label: 'Department Notices', icon: Bell },
    { id: 'pending-bills', label: 'Pending Bills', icon: Fish },
    { id: 'ot', label: 'My Overtime', icon: Clock },
    { id: 'food-orders', label: 'Food Orders', icon: Utensils },
    { id: 'gate-pass', label: 'Gate Pass', icon: DoorOpen },
    { id: 'short-leave', label: 'Short Leave', icon: Timer },
    { id: 'salary-advance', label: 'Salary Advance', icon: Banknote },
    { id: 'payroll', label: 'My Payslips', icon: Wallet },
    { id: 'profile', label: 'My Profile', icon: UserCircle },
  ], []);

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    setIsMobileMenuOpen(false);
  }, []);

  const checkPendingPolicies = useCallback(async () => {
    try {
      const res = await fetch('/api/company-documents?pendingOnly=true');
      if (res.ok) {
        const data = await res.json();
        if (data.documents && data.documents.length > 0) {
          setPendingMandatoryDocs(data.documents);
          setIsMandatoryModalOpen(true);
        }
      }
    } catch (err) {
      console.error("Error checking pending policies:", err);
    }
  }, []);

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

            // Redirect to admin dashboard if admin, super admin, or sectional head
            if (userData.role === "SUPER_ADMIN" || userData.role === "ADMIN" || userData.role === "SECTIONAL_HEAD") {
              router.push(userData.role === "SUPER_ADMIN" ? "/super-admin-dashboard" : "/admin-dashboard");
              return;
            }

            setUserRole(userData.role || "EMPLOYEE");
            setUserName(userData.firstName ? `${userData.firstName} ${userData.lastName || ''}` : user.email || '');

            // Non-blocking policy check
            checkPendingPolicies();
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchUserData();
  }, [user, router, checkPendingPolicies]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 px-4">
        <div className="flex flex-col items-center">
          <div className="w-11 h-11 border-4 border-primary/30 border-t-primary rounded-full mb-4 animate-spin" />
          <p className="text-muted-foreground font-medium animate-pulse">Initializing Your Workspace...</p>
        </div>
      </div>
    );
  }

  const NavItem = ({ item }: { item: any }) => {
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
            <div className="w-5 h-5 shrink-0" />
          )}
          <span className={`font-semibold text-sm tracking-tight transition-all duration-200 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
            {item.label}
          </span>
        </div>
        {isActive && !isSidebarCollapsed && (
          <ChevronRight className="h-4 w-4 opacity-50" />
        )}
      </button>
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-primary/20">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 sticky top-0 h-screen transition-all duration-200 z-40 ${isSidebarCollapsed ? 'w-20 px-2' : 'w-72 px-6'}`}>
        <div className={`flex items-center pt-6 pb-4 relative shrink-0 ${isSidebarCollapsed ? 'justify-center px-0' : 'px-2 gap-3'}`}>
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-inner flex-shrink-0">
            <LayoutDashboard className="text-primary-foreground w-6 h-6" />
          </div>
          <div className={`transition-all duration-200 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">AttendX</h1>
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest leading-none">Employee Portal</p>
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

        <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar py-2 pr-1">
          {navItems.map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
        </nav>

        <div className="mt-auto pt-4 pb-6 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <Button
            variant="outline"
            title={isSidebarCollapsed ? "Sign Out" : undefined}
            className={`w-full justify-start rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 transition-all border-slate-200 dark:border-slate-800 ${isSidebarCollapsed ? 'px-0 justify-center' : 'gap-3'}`}
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4 text-red-500" />
            <span className={`font-bold transition-all duration-200 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>Sign Out</span>
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
                <SheetHeader className="p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
                  <SheetTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                      <LayoutDashboard className="text-primary-foreground w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <span className="text-xl font-bold block tracking-tight">AttendX</span>
                      <span className="text-[10px] text-primary font-bold uppercase tracking-widest">Employee Portal</span>
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <div className="px-4 py-2 space-y-2 flex-1 overflow-y-auto custom-scrollbar pb-6">
                  {navItems.map((item) => (
                    <NavItem key={item.id} item={item} />
                  ))}
                </div>
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                  <Button variant="outline" className="w-full justify-start gap-3 rounded-xl border-slate-200 dark:border-slate-800" onClick={() => signOut()}>
                    <LogOut className="h-4 w-4 text-red-500" />
                    <span className="font-bold">Sign Out</span>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <span className="font-bold text-lg tracking-tight">Portal</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary">
              {userName?.charAt(0) || 'U'}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-10 min-w-0 custom-scrollbar">
          {/* Top Highlighted Employee Daily Salary & Biometric Credit Card Banner */}
          <EmployeeDailySalaryBanner />
          <Tabs value={activeTab} className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                   <div className="w-2 h-10 bg-primary rounded-full hidden md:block" />
                   <h2 className="text-4xl font-black tracking-tight text-slate-800 dark:text-slate-100">
                    {navItems.find(i => i.id === activeTab)?.label}
                   </h2>
                </div>
                <p className="text-sm text-muted-foreground font-medium pl-0 md:pl-5 capitalize">
                  Hi {userName.split(' ')[0]}, welcome back to your dashboard.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <span className="px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 border-r border-slate-100 dark:border-slate-800 mr-2">Quick View</span>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => handleTabChange('attendance')}>
                  <Clock className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => handleTabChange('tasks')}>
                  <CheckSquare className="h-4 w-4" />
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
              {activeTab === "attendance" && (
                <TabsContent value="attendance" className="mt-0 focus-visible:outline-none">
                  <AttendanceCheckInOut />
                </TabsContent>
              )}

              {activeTab === "documents" && (
                <TabsContent value="documents" className="mt-0 focus-visible:outline-none">
                  <EmployeeDocuments />
                </TabsContent>
              )}

              {activeTab === "leave" && (
                <TabsContent value="leave" className="mt-0 focus-visible:outline-none">
                  <LeaveManagement />
                </TabsContent>
              )}

              {activeTab === "off-day" && (
                <TabsContent value="off-day" className="mt-0 focus-visible:outline-none">
                  <OffDayManagement />
                </TabsContent>
              )}

              {activeTab === "tasks" && (
                <TabsContent value="tasks" className="mt-0 focus-visible:outline-none">
                  <EmployeeTaskDashboard />
                </TabsContent>
              )}

              {activeTab === "department-chat" && (
                <TabsContent value="department-chat" className="mt-0 focus-visible:outline-none">
                  <DepartmentChatBox />
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

              {activeTab === "food-orders" && (
                <TabsContent value="food-orders" className="mt-0 focus-visible:outline-none">
                  <FoodOrderManagement />
                </TabsContent>
              )}

              {activeTab === "payroll" && (
                <TabsContent value="payroll" className="mt-0 focus-visible:outline-none">
                  <EmployeePayslips />
                </TabsContent>
              )}

              {activeTab === "ot" && (
                <TabsContent value="ot" className="mt-0 focus-visible:outline-none">
                  <OTManagement />
                </TabsContent>
              )}

              {activeTab === "gate-pass" && (
                <TabsContent value="gate-pass" className="mt-0 focus-visible:outline-none">
                  <GatePassManagement />
                </TabsContent>
              )}

              {activeTab === "short-leave" && (
                <TabsContent value="short-leave" className="mt-0 focus-visible:outline-none">
                  <ShortLeaveManagement />
                </TabsContent>
              )}

              {activeTab === "salary-advance" && (
                <TabsContent value="salary-advance" className="mt-0 focus-visible:outline-none">
                  <SalaryAdvanceManagement />
                </TabsContent>
              )}

              {activeTab === "profile" && (
                <TabsContent value="profile" className="mt-0 focus-visible:outline-none">
                  <UserProfile />
                </TabsContent>
              )}
            </motion.div>
          </Tabs>
        </main>
      </div>

      {/* Gating Mandatory Policy Acceptance Modal */}
      <MandatoryPolicyModal
        pendingDocuments={pendingMandatoryDocs}
        isOpen={isMandatoryModalOpen}
        onAllCompleted={() => {
          setIsMandatoryModalOpen(false);
          setPendingMandatoryDocs([]);
        }}
      />

      {/* Automatic Department Notice Popup Banner */}
      <NoticePopupModal />
    </div>
  );
}
