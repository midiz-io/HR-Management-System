import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/util/supabase/component';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
  FaUserCheck, 
  FaUserClock, 
  FaMapMarkerAlt, 
  FaUsers, 
  FaSpinner,
  FaExclamationTriangle,
  FaCalendarAlt,
  FaPlus,
  FaFolderOpen,
  FaExternalLinkAlt
} from 'react-icons/fa';
import { format } from 'date-fns';
import { getLocationColor } from '@/lib/locationColors';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalLocations: number;
  todayAttendance: {
    present: number;
    late: number;
    absent: number;
    total: number;
  };
  recentCheckIns: Array<{
    id: string;
    userName: string;
    locationName: string;
    time: string;
  }>;
}

const DashboardOverview: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [initializingLeaveTypes, setInitializingLeaveTypes] = useState<boolean>(false);
  const { toast } = useToast();

  // Reference to store Supabase subscription
  const supabaseSubscription = useRef<any>(null);

  // Fetch dashboard stats on component mount and set up real-time subscription
  useEffect(() => {
    fetchDashboardStats();
    setupRealtimeSubscription();

    // Cleanup subscription on component unmount
    return () => {
      if (supabaseSubscription.current) {
        supabaseSubscription.current.unsubscribe();
      }
    };
  }, []);

  // Set up real-time subscription to attendance changes
  const setupRealtimeSubscription = async () => {
    try {
      const supabase = createClient();
      
      // Subscribe to attendance table changes
      supabaseSubscription.current = supabase
        .channel('attendance-changes')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'Attendance' 
          }, 
          (payload: any) => {
            console.log('Real-time attendance update received:', payload);
            // Refresh dashboard data when attendance changes
            fetchDashboardStats();
            
            // Show toast notification for real-time update
            const eventType = payload.eventType;
            if (eventType === 'INSERT') {
              toast({
                title: 'New Check-in',
                description: 'An employee has just checked in',
                variant: 'default',
              });
            } else if (eventType === 'UPDATE') {
              toast({
                title: 'Check-out',
                description: 'An employee has just checked out',
                variant: 'default',
              });
            }
          }
        )
        .subscribe();
      
      // Also subscribe to user table changes (in case new users are added)
      supabase
        .channel('user-changes')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'User' 
          }, 
          (payload: any) => {
            console.log('Real-time user update received:', payload);
            // Refresh dashboard data when user data changes
            fetchDashboardStats();
          }
        )
        .subscribe();
      
      console.log('Real-time subscriptions set up');
    } catch (error) {
      console.error('Error setting up real-time subscription:', error);
    }
  };

  // Fetch dashboard stats from API
  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      
      // Get the current user from Supabase
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Make the API request with the user ID in the authorization header
      const response = await fetch('/api/admin/dashboard', {
        headers: {
          'Authorization': user.id,
          // Add cache busting parameter to prevent caching
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        // Add timestamp to force fresh data
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard statistics');
      }
      
      const data = await response.json();
      console.log('Dashboard stats fetched:', data);
      setStats(data);
    } catch (error) {
      console.error('Error fetching dashboard statistics:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch dashboard statistics',
      });
    } finally {
      setLoading(false);
    }
  };

  // Format time for display
  const formatTime = (timeString: string) => {
    return format(new Date(timeString), 'h:mm a');
  };

  // Initialize leave types
  const handleInitializeLeaveTypes = async () => {
    try {
      setInitializingLeaveTypes(true);
      
      // Get the current user from Supabase
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const response = await fetch('/api/leave-types/init', {
        method: 'POST',
        headers: {
          'Authorization': user.id,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initialize leave types');
      }
      
      const data = await response.json();
      
      toast({
        title: 'Success',
        description: data.message,
      });
    } catch (error: any) {
      console.error('Error initializing leave types:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to initialize leave types',
      });
    } finally {
      setInitializingLeaveTypes(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <FaSpinner className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  // If we don't have stats yet, show a placeholder
  if (!stats) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dashboard Overview</CardTitle>
            <CardDescription>
              No data available at the moment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center py-8">
              <FaExclamationTriangle className="h-8 w-8 text-yellow-500" />
              <span className="ml-2 text-muted-foreground">Unable to load dashboard data</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Today's date */}
      <div className="flex items-center space-x-2">
        <FaCalendarAlt className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </h2>
      </div>

      {/* Employee Personal File System Feature Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white p-5 sm:p-6 shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
              <FaFolderOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase font-extrabold tracking-wider bg-white/20 px-2 py-0.5 rounded-full text-white">
                  Live System
                </span>
                <span className="text-xs text-white/90 font-medium">Full Access</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold mt-1 text-white">
                Employee Personal File Management System
              </h3>
              <p className="text-xs sm:text-sm text-white/80 mt-0.5 max-w-xl">
                Access digitized employee dossiers, personal records, identity cards, CVs, and contracts in a dedicated workspace.
              </p>
            </div>
          </div>
          <div className="shrink-0 pt-2 md:pt-0">
            <Button
              onClick={() => window.open('https://dutch-trails-employee-files.vercel.app/', '_blank', 'noopener,noreferrer')}
              className="bg-white text-emerald-800 hover:bg-slate-100 font-bold shadow-md hover:shadow-lg rounded-xl h-11 px-5 flex items-center gap-2 group transition-all"
            >
              <span>Launch Files Portal</span>
              <FaExternalLinkAlt className="h-3.5 w-3.5 text-emerald-700 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stats-grid">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Employees</p>
                <h3 className="text-2xl font-bold">{stats.totalUsers}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <FaUsers className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Today</p>
                <h3 className="text-2xl font-bold">{stats.activeUsers}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round((stats.activeUsers / stats.totalUsers) * 100)}% of total
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <FaUserCheck className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Locations</p>
                <h3 className="text-2xl font-bold">{stats.totalLocations}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <FaMapMarkerAlt className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Attendance Rate</p>
                <h3 className="text-2xl font-bold">
                  {stats.todayAttendance.total > 0 
                    ? Math.round(((stats.todayAttendance.present + stats.todayAttendance.late) / stats.todayAttendance.total) * 100) 
                    : 0}%
                </h3>
                <div className="flex flex-col text-xs text-muted-foreground mt-1">
                  <span>
                    <span className="text-green-600 font-medium">{stats.todayAttendance.present}</span> present
                  </span>
                  <span>
                    <span className="text-yellow-600 font-medium">{stats.todayAttendance.late}</span> late
                  </span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <FaUserClock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Attendance</CardTitle>
          <CardDescription>
            Breakdown of employee attendance status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col items-center p-4 bg-green-50 rounded-lg">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-100 mb-2">
                  <FaUserCheck className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-xl font-bold">{stats.todayAttendance.present}</span>
                <span className="text-sm text-muted-foreground">Present</span>
              </div>
              
              <div className="flex flex-col items-center p-4 bg-yellow-50 rounded-lg">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-yellow-100 mb-2">
                  <FaUserClock className="h-5 w-5 text-yellow-600" />
                </div>
                <span className="text-xl font-bold">{stats.todayAttendance.late}</span>
                <span className="text-sm text-muted-foreground">Late</span>
              </div>
              
              <div className="flex flex-col items-center p-4 bg-red-50 rounded-lg">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-red-100 mb-2">
                  <FaExclamationTriangle className="h-5 w-5 text-red-600" />
                </div>
                <span className="text-xl font-bold">{stats.todayAttendance.absent}</span>
                <span className="text-sm text-muted-foreground">Absent</span>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Attendance Progress</span>
                <span>{stats.todayAttendance.total > 0 
                  ? Math.round(((stats.todayAttendance.present + stats.todayAttendance.late) / stats.todayAttendance.total) * 100) 
                  : 0}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="flex h-full">
                  <div 
                    className="h-full bg-green-500" 
                    style={{ 
                      width: `${stats.todayAttendance.total > 0 
                        ? Math.round((stats.todayAttendance.present / stats.todayAttendance.total) * 100) 
                        : 0}%` 
                    }}
                  />
                  <div 
                    className="h-full bg-yellow-500" 
                    style={{ 
                      width: `${stats.todayAttendance.total > 0 
                        ? Math.round((stats.todayAttendance.late / stats.todayAttendance.total) * 100) 
                        : 0}%` 
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-green-600">Present: {stats.todayAttendance.present}</span>
                <span className="text-yellow-600">Late: {stats.todayAttendance.late}</span>
                <span className="text-red-600">Absent: {stats.todayAttendance.absent}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leave Management Setup */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Management Setup</CardTitle>
          <CardDescription>
            Initialize the leave management system with default leave types
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click the button below to initialize the leave management system with the standard leave types:
              Annual Leave (14 days), Casual Leave (7 days), Medical Leave (as approved), and No-Pay Leave (unlimited).
            </p>
            <p className="text-sm text-muted-foreground">
              This action only needs to be performed once when setting up the system.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleInitializeLeaveTypes} 
            disabled={initializingLeaveTypes}
            className="w-full"
          >
            {initializingLeaveTypes ? (
              <>
                <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <FaPlus className="mr-2 h-4 w-4" />
                Initialize Leave Types
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Recent check-ins */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Check-ins</CardTitle>
          <CardDescription>
            Latest employee check-ins across all locations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentCheckIns.length > 0 ? (
            <div className="space-y-4">
              {stats.recentCheckIns.map((checkIn) => (
                <div key={checkIn.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                      <FaUserCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{checkIn.userName}</p>
                      <p className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center mt-1 border ${getLocationColor(checkIn.locationName).bg} ${getLocationColor(checkIn.locationName).text} ${getLocationColor(checkIn.locationName).border}`}>
                        <FaMapMarkerAlt className="h-3 w-3 mr-1" />
                        {checkIn.locationName}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatTime(checkIn.time)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              No recent check-ins to display
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardOverview;