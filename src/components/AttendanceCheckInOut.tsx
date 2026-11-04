import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/util/supabase/component';
import Lottie from 'lottie-react';
import tickAnimation from '../../public/tick.json';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { FaMapMarkerAlt, FaSignInAlt, FaSignOutAlt, FaSpinner, FaExclamationTriangle, FaLocationArrow } from 'react-icons/fa';
import { 
  getCurrentPosition, 
  getLocationWithFallback, 
  checkGeolocationPermission, 
  getBrowserLocationInstructions,
  GeolocationError,
  GEOLOCATION_ERROR_CODES,
  calculateDistance
} from '@/util/geofencing';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { getLocationColor } from '@/lib/locationColors';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon, FileDown, Filter, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Location {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
}

interface Attendance {
  id: string;
  locationId: string;
  checkInTime: string;
  checkOutTime: string | null;
  status: string;
  location: Location;
}

const AttendanceCheckInOut: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [currentAttendance, setCurrentAttendance] = useState<Attendance | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [locationLoading, setLocationLoading] = useState<boolean>(true);
  const [attendanceLoading, setAttendanceLoading] = useState<boolean>(true);
  const [locationPermission, setLocationPermission] = useState<PermissionState | 'unsupported' | 'unknown'>('unknown');
  const [locationError, setLocationError] = useState<GeolocationError | null>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState<boolean>(false);
  const [locationVerified, setLocationVerified] = useState<boolean>(false);
  const [checkOutLocationVerified, setCheckOutLocationVerified] = useState<boolean>(false);
  const [verifyingLocation, setVerifyingLocation] = useState<boolean>(false);
  const [userPosition, setUserPosition] = useState<{ latitude: number; longitude: number; timestamp: number } | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState<boolean>(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isFilterActive, setIsFilterActive] = useState<boolean>(false);
  const [generatingPDF, setGeneratingPDF] = useState<boolean>(false);
  const { toast } = useToast();

  // Shift & Proximity Auto Check-Out State
  interface ShiftInfoState {
    hasShift: boolean;
    shiftName: string | null;
    rosterStartTime: string | null;
    rosterEndTime: string | null;
    shiftStartDateTime: string | null;
    shiftEndDateTime: string | null;
    isShiftEnded: boolean;
    remainingSeconds: number;
    hasApprovedOT: boolean;
    approvedOTDetails: any | null;
  }

  const [shiftInfo, setShiftInfo] = useState<ShiftInfoState | null>(null);
  const [shiftTimerSeconds, setShiftTimerSeconds] = useState<number>(0);
  const [isProximityMonitoring, setIsProximityMonitoring] = useState<boolean>(false);
  const watchPositionIdRef = useRef<number | null>(null);

  // Reference to store Supabase subscription
  const supabaseSubscription = useRef<any>(null);

  // Keep track of proximity readings count, consecutive out-of-bounds readings, and execution lock
  const proximityReadingsRef = useRef<number>(0);
  const consecutiveOutOfBoundsRef = useRef<number>(0);
  const isAutoCheckingOutRef = useRef<boolean>(false);

  // Fetch locations and attendance data on component mount and set up real-time subscription
  useEffect(() => {
    fetchLocations();
    fetchAttendance();
    checkLocationPermission();
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
      
      // Subscribe to attendance table changes for the current user
      supabaseSubscription.current = supabase
        .channel('employee-attendance-changes')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'Attendance' 
          }, 
          (payload: any) => {
            console.log('Real-time attendance update received:', payload);
            // Refresh attendance data when attendance changes
            fetchAttendance();
          }
        )
        .subscribe();
      
      console.log('Real-time subscription to attendance changes set up');
    } catch (error) {
      console.error('Error setting up real-time subscription:', error);
    }
  };

  // Check location permission
  const checkLocationPermission = async () => {
    const permission = await checkGeolocationPermission();
    setLocationPermission(permission);
    
    // If permission is denied, show the dialog
    if (permission === 'denied') {
      setShowPermissionDialog(true);
    }
  };

  // Fetch locations from API
  const fetchLocations = async () => {
    try {
      setLocationLoading(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id || session?.user?.id;
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      } else if (user?.id) {
        headers['Authorization'] = user.id;
      }
      if (user?.id) {
        headers['x-user-id'] = user.id;
      }
      const response = await fetch('/api/locations', { headers });
      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }
      const data = await response.json();
      setLocations(data);
      if (data.length > 0) {
        setSelectedLocationId(data[0].id);
        // Try to auto-detect closest location
        autoDetectClosestLocation(data);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch locations',
      });
    } finally {
      setLocationLoading(false);
    }
  };

  // Auto-detect closest location based on user's current position
  const autoDetectClosestLocation = async (locationsList: Location[]) => {
    try {
      const permission = await checkGeolocationPermission();
      if (permission !== 'granted') {
        return; // Skip auto-detection if permission not granted
      }

      const position = await getLocationWithFallback();
      if (!position) return;

      const userLat = position.latitude;
      const userLon = position.longitude;
      setUserPosition({ latitude: userLat, longitude: userLon, timestamp: Date.now() });

      // Find the closest location that the user is within
      let closestLocation: Location | null = null;
      let closestDistance = Infinity;

      for (const location of locationsList) {
        const distance = calculateDistance(
          userLat,
          userLon,
          location.latitude,
          location.longitude
        );

        // Check if within geofence radius
        if (distance <= location.radius) {
          if (distance < closestDistance) {
            closestDistance = distance;
            closestLocation = location;
          }
        }
      }

      // If found a location within geofence, auto-select it
      if (closestLocation) {
        setSelectedLocationId(closestLocation.id);
        setLocationVerified(true);
        toast({
          title: 'Location Auto-Selected',
          description: `${closestLocation.name} has been selected based on your current location.`,
        });
      }
    } catch (error) {
      // Silently fail auto-detection - user can still manually select
      console.log('Auto-detection failed, user can manually select:', error);
    }
  };

  // Verify selected location with current GPS position (for check-in or check-out)
  const verifyLocation = async (forCheckOut: boolean = false) => {
    if (!selectedLocationId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a location first',
      });
      return;
    }

    const selectedLocation = locations.find(loc => loc.id === selectedLocationId);
    if (!selectedLocation) return;

    try {
      setVerifyingLocation(true);
      setLocationError(null);

      const permission = await checkGeolocationPermission();
      setLocationPermission(permission);

      if (permission === 'denied') {
        setShowPermissionDialog(true);
        if (forCheckOut) {
          setCheckOutLocationVerified(false);
        } else {
          setLocationVerified(false);
        }
        throw new GeolocationError('Location permission denied. Please enable location access in your browser settings.', GEOLOCATION_ERROR_CODES.PERMISSION_DENIED);
      }

      const position = await getLocationWithFallback();
      if (!position) {
        if (forCheckOut) {
          setCheckOutLocationVerified(false);
        } else {
          setLocationVerified(false);
        }
        throw new GeolocationError('Unable to get your current location', undefined);
      }

      const userLat = position.latitude;
      const userLon = position.longitude;
      setUserPosition({ latitude: userLat, longitude: userLon, timestamp: Date.now() });

      // Check if user is within the selected location's geofence
      const distance = calculateDistance(
        userLat,
        userLon,
        selectedLocation.latitude,
        selectedLocation.longitude
      );

      // Add a generous tolerance buffer to account for GPS inaccuracies (matches backend)
      // Minimum 1000m (1km) or 200% of radius, whichever is larger
      // This ensures frontend verification matches backend validation
      const toleranceBuffer = Math.max(selectedLocation.radius * 2, 1000);
      const effectiveRadius = selectedLocation.radius + toleranceBuffer;

      if (distance <= effectiveRadius) {
        if (forCheckOut) {
          setCheckOutLocationVerified(true);
        } else {
          setLocationVerified(true);
        }
        toast({
          title: 'Location Verified',
          description: `You are within ${selectedLocation.name}. You can now mark attendance.`,
        });
      } else {
        if (forCheckOut) {
          setCheckOutLocationVerified(false);
        } else {
          setLocationVerified(false);
        }
        const distanceInMeters = Math.round(distance);
        toast({
          variant: 'destructive',
          title: 'Location Not Verified',
          description: `You are ${distanceInMeters}m away from ${selectedLocation.name}. Required: within ${Math.round(effectiveRadius)}m.`,
        });
      }
    } catch (error: any) {
      console.error('Error verifying location:', error);
      if (forCheckOut) {
        setCheckOutLocationVerified(false);
      } else {
        setLocationVerified(false);
      }
      if (error instanceof GeolocationError) {
        setLocationError(error);
      } else {
        setLocationError(new GeolocationError(error.message || 'Failed to verify location', undefined));
      }
    } finally {
      setVerifyingLocation(false);
    }
  };

  // Reset location verification when location selection changes
  useEffect(() => {
    if (selectedLocationId) {
      if (currentAttendance) {
        setCheckOutLocationVerified(false);
      } else {
        setLocationVerified(false);
      }
      setUserPosition(null);
    }
  }, [selectedLocationId, currentAttendance]);

  // Fetch attendance records from API
  const fetchAttendance = async () => {
    try {
      setAttendanceLoading(true);
      
      // Get the current user from Supabase
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id || session?.user?.id;
      
      if (!currentUserId) {
        throw new Error('User not authenticated');
      }
      
      const response = await fetch('/api/attendance', {
        headers: {
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : currentUserId,
          'x-user-id': currentUserId
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch attendance records');
      }
      
      const data = await response.json();
      
      // Find current (open) attendance record
      const current = data.find((a: Attendance) => a.checkOutTime === null);
      setCurrentAttendance(current || null);
      
      // If there's a current attendance, set the selected location to the check-in location
      if (current) {
        setSelectedLocationId(current.locationId);
        setCheckOutLocationVerified(false); // Reset check-out verification
      }
      
      // Check for background auto-checkouts to show a goodbye toast
      if (data && data.length > 0) {
        // Since data is ordered by checkInTime 'desc', the first item is the latest
        const latest = data[0];
        if (latest.checkOutTime !== null && latest.notes && latest.notes.includes('Auto check-out')) {
          const lastShownId = localStorage.getItem('lastShownAutoCheckoutId');
          if (lastShownId !== latest.id) {
            let toastTitle = 'Auto Checked Out! 👋';
            let toastDesc = 'Goodbye! Have a great rest of your day.';
            
            if (latest.notes.includes('Shift end time reached')) {
              toastTitle = 'Shift Completed! 👋';
              toastDesc = 'Goodbye! Have a great rest of your day. You have been checked out automatically because your shift ended.';
            } else if (latest.notes.includes('Exited proximity geofence')) {
              toastTitle = 'Auto Checked Out! 👋';
              toastDesc = 'Goodbye! You have been automatically checked out because you walked out of the geofenced area.';
            }
            
            toast({
              title: toastTitle,
              description: toastDesc,
            });
            localStorage.setItem('lastShownAutoCheckoutId', latest.id);
          }
        }
      }
      
      // Set attendance history
      setAttendanceHistory(data);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch attendance records',
      });
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Fetch shift details and OT status for active check-in
  const fetchShiftInfo = async () => {
    try {
      const response = await fetch('/api/attendance/user-shift');
      if (response.ok) {
        const data = await response.json();
        setShiftInfo(data);
        setShiftTimerSeconds(data.remainingSeconds || 0);
      }
    } catch (err) {
      console.error('Error fetching shift info:', err);
    }
  };

  // Trigger automatic check-out API call
  const executeAutoCheckOut = async (notes: string) => {
    if (!currentAttendance || isAutoCheckingOutRef.current) return;
    try {
      isAutoCheckingOutRef.current = true;
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id || session?.user?.id;
      if (!currentUserId) {
        isAutoCheckingOutRef.current = false;
        return;
      }

      let lat = currentAttendance.location?.latitude || 0;
      let lng = currentAttendance.location?.longitude || 0;

      if (userPosition) {
        lat = userPosition.latitude;
        lng = userPosition.longitude;
      }

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : currentUserId,
          'x-user-id': currentUserId
        },
        body: JSON.stringify({
          locationId: currentAttendance.locationId,
          latitude: lat,
          longitude: lng,
          type: 'check-out',
          notes: notes
        })
      });

      if (response.ok) {
        // fetchAttendance will run and refresh the records. We keep isAutoCheckingOutRef.current = true
        // until the fetch completes and updates currentAttendance to null, which disables the timers/watchers.
        await fetchAttendance();
      } else {
        isAutoCheckingOutRef.current = false;
      }
    } catch (error) {
      console.error('Error executing auto check-out:', error);
      isAutoCheckingOutRef.current = false;
    }
  };

  // Shift countdown timer effect & shift end auto check-out
  useEffect(() => {
    if (currentAttendance) {
      fetchShiftInfo();
    } else {
      setShiftInfo(null);
      setShiftTimerSeconds(0);
    }
  }, [currentAttendance]);

  useEffect(() => {
    if (!currentAttendance || !shiftInfo?.hasShift) return;

    const timer = setInterval(() => {
      setShiftTimerSeconds((prev) => {
        if (prev <= 1) {
          // Timer reached 0
          if (!shiftInfo.hasApprovedOT) {
            executeAutoCheckOut(`Auto check-out: Shift end time reached (${shiftInfo.rosterEndTime || ''})`);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentAttendance, shiftInfo]);

  // Proximity Gate Geofence Exit monitoring effect
  useEffect(() => {
    if (!currentAttendance || !currentAttendance.location) {
      if (watchPositionIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
        watchPositionIdRef.current = null;
      }
      setIsProximityMonitoring(false);
      proximityReadingsRef.current = 0;
      consecutiveOutOfBoundsRef.current = 0;
      isAutoCheckingOutRef.current = false;
      return;
    }

    proximityReadingsRef.current = 0;
    consecutiveOutOfBoundsRef.current = 0;
    isAutoCheckingOutRef.current = false;

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      setIsProximityMonitoring(true);

      watchPositionIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          proximityReadingsRef.current += 1;

          // Ignore the first 3 readings to allow the browser GPS to settle (accuracy, cache)
          if (proximityReadingsRef.current <= 3) {
            console.log(`Ignoring initial proximity reading #${proximityReadingsRef.current} to allow GPS to settle.`);
            return;
          }

          // Ignore readings with poor accuracy (e.g., accuracy > 150m)
          const accuracy = position.coords.accuracy;
          if (accuracy && accuracy > 150) {
            console.log(`Ignoring proximity reading due to low accuracy: ${accuracy}m (required: <= 150m).`);
            return;
          }

          const uLat = position.coords.latitude;
          const uLon = position.coords.longitude;
          const loc = currentAttendance.location;

          const distance = calculateDistance(uLat, uLon, loc.latitude, loc.longitude);
          const toleranceBuffer = Math.max(loc.radius * 2, 1000);
          const effectiveRadius = loc.radius + toleranceBuffer;

          if (distance > effectiveRadius) {
            consecutiveOutOfBoundsRef.current += 1;
            console.warn(`User out of proximity bounds. Reading #${consecutiveOutOfBoundsRef.current}. Distance: ${Math.round(distance)}m > ${Math.round(effectiveRadius)}m (Accuracy: ${accuracy}m)`);
            
            // Require 3 consecutive out-of-bounds readings to avoid false positives (e.g. temporary GPS drift)
            if (consecutiveOutOfBoundsRef.current >= 3) {
              if (watchPositionIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchPositionIdRef.current);
                watchPositionIdRef.current = null;
              }
              setIsProximityMonitoring(false);
              executeAutoCheckOut(`Auto check-out: Exited proximity geofence gate (Distance: ${Math.round(distance)}m)`);
            }
          } else {
            // Reset consecutive out-of-bounds count when a verified reading is within bounds
            consecutiveOutOfBoundsRef.current = 0;
          }
        },
        (error) => {
          console.warn('Proximity watch error:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 15000,
          timeout: 30000
        }
      );
    }

    return () => {
      if (watchPositionIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
        watchPositionIdRef.current = null;
      }
      setIsProximityMonitoring(false);
      proximityReadingsRef.current = 0;
      consecutiveOutOfBoundsRef.current = 0;
    };
  }, [currentAttendance]);

  // Helper to format remaining seconds as HH:MM:SS
  const formatCountdown = (totalSeconds: number) => {
    if (totalSeconds <= 0) return '00:00:00';
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Handle check-in
  const handleCheckIn = async () => {
    if (!selectedLocationId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a location',
      });
      return;
    }

    if (!locationVerified) {
      toast({
        variant: 'destructive',
        title: 'Location Not Verified',
        description: 'Please verify your location before checking in',
      });
      return;
    }

    // Reset any previous location errors
    setLocationError(null);
    
    try {
      setLoading(true);
      
      // Optimize: Reuse verified position immediately (extended window for flexibility)
      let position: GeolocationCoordinates;
      const RECENT_POSITION_THRESHOLD = 60000; // 60 seconds for flexibility (allows time between verification and check-in)
      
      if (userPosition && locationVerified && (Date.now() - userPosition.timestamp) < RECENT_POSITION_THRESHOLD) {
        // Reuse recently verified position for instant check-in
        position = {
          latitude: userPosition.latitude,
          longitude: userPosition.longitude,
        } as GeolocationCoordinates;
      } else {
        // Fallback: Get fresh position (shouldn't happen if verified recently)
        try {
          const freshPosition = await getLocationWithFallback();
          if (!freshPosition) {
            throw new GeolocationError('Unable to get your current location', undefined);
          }
          position = freshPosition;
        } catch (geoError: any) {
          console.error('Geolocation error:', geoError);
          setLocationError(geoError instanceof GeolocationError ? geoError : new GeolocationError(geoError.message, undefined));
          throw geoError;
        }
      }
      
      // Optimize: Pre-fetch user authentication in parallel
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id || session?.user?.id;
      
      if (!currentUserId) {
        throw new Error('User not authenticated');
      }
      
      // Send check-in request immediately
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : currentUserId,
          'x-user-id': currentUserId
        },
        body: JSON.stringify({
          locationId: selectedLocationId,
          latitude: position.latitude,
          longitude: position.longitude,
          type: 'check-in',
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        console.error('Error parsing response:', e);
        throw new Error('Invalid response from server');
      }
      
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to check in');
      }
      
      toast({
        title: 'Success',
        description: 'You have successfully checked in',
      });
      
      // Trigger success animation
      setShowSuccessAnimation(true);
      setTimeout(() => setShowSuccessAnimation(false), 1200);
      
      // Reset location verification (not needed while checked in)
      setLocationVerified(false);
      setUserPosition(null);
      
      // Refresh attendance data
      fetchAttendance();
    } catch (error: any) {
      console.error('Error checking in:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to check in',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle check-out
  const handleCheckOut = async () => {
    if (!currentAttendance) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No active check-in found',
      });
      return;
    }

    if (!selectedLocationId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a location',
      });
      return;
    }

    if (!checkOutLocationVerified) {
      toast({
        variant: 'destructive',
        title: 'Location Not Verified',
        description: 'Please verify your location before checking out',
      });
      return;
    }

    // Enforce 15-minute minimum check-in duration
    const checkInMs = new Date(currentAttendance.checkInTime).getTime();
    const elapsedMins = (Date.now() - checkInMs) / (1000 * 60);

    if (elapsedMins < 15) {
      const remainingMins = Math.ceil(15 - elapsedMins);
      toast({
        variant: 'destructive',
        title: 'Check-Out Restricted',
        description: `You cannot check out within 15 minutes of checking in. Please wait ${remainingMins} more minute(s).`,
      });
      return;
    }

    // Reset any previous location errors
    setLocationError(null);
    
    try {
      setLoading(true);
      
      // Optimize: Reuse verified position immediately (extended window for flexibility)
      let position: GeolocationCoordinates;
      const RECENT_POSITION_THRESHOLD = 60000; // 60 seconds for flexibility (allows time between verification and check-out)
      
      if (userPosition && checkOutLocationVerified && (Date.now() - userPosition.timestamp) < RECENT_POSITION_THRESHOLD) {
        // Reuse recently verified position for instant check-out
        position = {
          latitude: userPosition.latitude,
          longitude: userPosition.longitude,
        } as GeolocationCoordinates;
      } else {
        // Fallback: Check permission and get fresh position (shouldn't happen if verified recently)
        const permission = await checkGeolocationPermission();
        setLocationPermission(permission);
        
        if (permission === 'denied') {
          setShowPermissionDialog(true);
          throw new GeolocationError('Location permission denied. Please enable location access in your browser settings.', GEOLOCATION_ERROR_CODES.PERMISSION_DENIED);
        }
        
        try {
          const freshPosition = await getLocationWithFallback();
          if (!freshPosition) {
            throw new GeolocationError('Unable to get your current location', undefined);
          }
          position = freshPosition;
        } catch (geoError: any) {
          console.error('Geolocation error:', geoError);
          setLocationError(geoError instanceof GeolocationError ? geoError : new GeolocationError(geoError.message, undefined));
          throw geoError;
        }
      }
      
      // Optimize: Pre-fetch user authentication in parallel
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id || session?.user?.id;
      
      if (!currentUserId) {
        throw new Error('User not authenticated');
      }
      
      // Send check-out request with selected location
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : currentUserId,
          'x-user-id': currentUserId
        },
        body: JSON.stringify({
          locationId: selectedLocationId,
          latitude: position.latitude,
          longitude: position.longitude,
          type: 'check-out',
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        console.error('Error parsing response:', e);
        throw new Error('Invalid response from server');
      }
      
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to check out');
      }
      
      toast({
        title: 'Success',
        description: 'You have successfully checked out',
      });
      
      // Trigger success animation
      setShowSuccessAnimation(true);
      setTimeout(() => setShowSuccessAnimation(false), 1500);
      
      // Reset location verification for next check-in
      setLocationVerified(false);
      setCheckOutLocationVerified(false);
      setUserPosition(null);
      
      // Refresh attendance data
      fetchAttendance();
    } catch (error: any) {
      console.error('Error checking out:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to check out',
      });
    } finally {
      setLoading(false);
    }
  };

  // Format date for display in Sri Lankan timezone
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Calculate duration between check-in and check-out
  const calculateDuration = (checkIn: string, checkOut: string | null) => {
    if (!checkOut) return 'In progress';
    
    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();
    const durationMs = end - start;
    
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  // Filtered attendance history
  const filteredHistory = attendanceHistory.filter(att => {
    if (!dateRange?.from) return true;
    
    const checkInDate = new Date(att.checkInTime);
    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
    
    return isWithinInterval(checkInDate, { start: from, end: to });
  });

  // Generate PDF report for the current user
  const generatePDFReport = async () => {
    try {
      setGeneratingPDF(true);
      
      const doc = new jsPDF();
      
      // Add header
      doc.setFillColor(41, 98, 255);
      doc.rect(0, 0, 210, 30, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.text('Attendance Report', 105, 15, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const dateRangeText = dateRange?.from 
        ? `Period: ${format(dateRange.from, 'MMM d, yyyy')} - ${dateRange.to ? format(dateRange.to, 'MMM d, yyyy') : format(dateRange.from, 'MMM d, yyyy')}`
        : 'Period: All Time';
      doc.text(dateRangeText, 105, 22, { align: 'center' });
      
      // Add Table
      const tableColumn = ["Location", "Date", "Check In", "Check Out", "Duration", "Status"];
      const tableRows = filteredHistory.map(att => [
        att.location?.name || 'Office Location',
        format(new Date(att.checkInTime), 'MMM d, yyyy'),
        format(new Date(att.checkInTime), 'h:mm a'),
        att.checkOutTime ? format(new Date(att.checkOutTime), 'h:mm a') : 'Pending',
        calculateDuration(att.checkInTime, att.checkOutTime),
        att.status
      ]);

      (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'grid',
        headStyles: { 
          fillColor: [41, 98, 255], 
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        styles: { fontSize: 9, cellPadding: 3 },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        didParseCell: function(data: any) {
          if (data.section === 'body' && data.column.index === 5) {
            const status = data.cell.raw;
            if (status === 'PRESENT') data.cell.styles.textColor = [0, 128, 0];
            else if (status === 'LATE') data.cell.styles.textColor = [217, 119, 6];
            else if (status === 'ABSENT') data.cell.styles.textColor = [220, 38, 38];
          }
        }
      });

      // Add Footer
      const finalY = (doc as any).lastAutoTable.finalY || 40;
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, 10, finalY + 10);
      
      doc.save(`Attendance_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
      toast({
        title: 'Report Downloaded',
        description: 'Your attendance report has been generated and downloaded.',
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to generate PDF report.',
      });
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Handle retry after location error
  const handleRetryLocation = async () => {
    setLocationError(null);
    await checkLocationPermission();
    
    // If permission is now granted, try a test location request
    if (locationPermission === 'granted') {
      try {
        await getCurrentPosition();
        toast({
          title: 'Success',
          description: 'Location access is now working!',
        });
      } catch (error) {
        console.error('Error getting location after retry:', error);
        if (error instanceof GeolocationError) {
          setLocationError(error);
        }
      }
    }
  };

  // Get browser-specific instructions
  const locationInstructions = getBrowserLocationInstructions();

  return (
    <div className="space-y-6 max-w-lg mx-auto md:max-w-none">
      {/* Success Animation Overlay */}
      <AnimatePresence>
        {showSuccessAnimation && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-2xl border border-primary/20 flex flex-col items-center"
            >
              <div className="w-[180px] h-[180px] sm:w-[250px] sm:h-[250px]">
                <Lottie 
                  animationData={tickAnimation} 
                  loop={false} 
                />
              </div>
              <p className="text-center text-lg sm:text-xl font-bold text-primary mt-2 animate-bounce">
                Success!
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location Permission Dialog */}
      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FaLocationArrow className="text-primary" />
              Location Access Required
            </DialogTitle>
            <DialogDescription>
              This app needs your location to verify you're within the workplace area.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert variant="destructive">
              <FaExclamationTriangle className="h-4 w-4" />
              <AlertTitle>Location permission denied</AlertTitle>
              <AlertDescription>
                You've denied location access to this site. Please follow the instructions below to enable it.
              </AlertDescription>
            </Alert>
            
            <div className="bg-muted p-3 rounded-md">
              <h4 className="font-medium mb-2">How to enable location access:</h4>
              <div className="text-sm space-y-1 whitespace-pre-line">
                {locationInstructions}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowPermissionDialog(false)}>Close</Button>
            <Button variant="outline" onClick={handleRetryLocation}>
              I've Enabled Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="shadow-sm overflow-hidden border-none sm:border-solid bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Attendance Check-In/Out</CardTitle>
          <CardDescription>
            Record your attendance by checking in and out
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Location Error Alert */}
          {locationError && (
            <Alert variant="destructive" className="mb-4">
              <FaExclamationTriangle className="h-4 w-4" />
              <AlertTitle>Location Error</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{locationError.message}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    if (locationError.code === GEOLOCATION_ERROR_CODES.PERMISSION_DENIED) {
                      setShowPermissionDialog(true);
                    } else {
                      handleRetryLocation();
                    }
                  }}
                >
                  <FaLocationArrow className="mr-2 h-4 w-4" />
                  {locationError.code === GEOLOCATION_ERROR_CODES.PERMISSION_DENIED 
                    ? 'Show Instructions' 
                    : 'Retry Location Access'}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Location Selection Section - Always Visible */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <FaMapMarkerAlt className="text-primary h-5 w-5" />
              <span className="font-medium">
                {currentAttendance ? 'Select location to check out' : 'Select location to check in'}
              </span>
            </div>
            
            {locationLoading ? (
              <div className="flex justify-center py-2">
                <FaSpinner className="animate-spin h-5 w-5 text-primary" />
              </div>
            ) : locations.length > 0 ? (
              <>
                <Select
                  value={selectedLocationId}
                  onValueChange={setSelectedLocationId}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        <div className="flex items-center">
                          <span className={`w-2 h-2 rounded-full mr-2 ${getLocationColor(location.name).dot}`} />
                          {location.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Location Verification Section - For both check-in and check-out */}
                <div className="space-y-3">
                  <Button
                    variant={(currentAttendance ? checkOutLocationVerified : locationVerified) ? "default" : "outline"}
                    onClick={() => verifyLocation(!!currentAttendance)}
                    disabled={verifyingLocation || !selectedLocationId || locationPermission === 'denied'}
                    className="w-full"
                  >
                    {verifyingLocation ? (
                      <>
                        <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                        Verifying Location...
                      </>
                    ) : (currentAttendance ? checkOutLocationVerified : locationVerified) ? (
                      <>
                        <FaMapMarkerAlt className="mr-2 h-4 w-4" />
                        Location Verified ✓
                      </>
                    ) : (
                      <>
                        <FaLocationArrow className="mr-2 h-4 w-4" />
                        Verify Location
                      </>
                    )}
                  </Button>

                  <AnimatePresence>
                    {((currentAttendance ? checkOutLocationVerified : locationVerified) && userPosition) && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/30">
                          <FaMapMarkerAlt className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <AlertTitle className="text-green-800 dark:text-green-300">Location Verified</AlertTitle>
                          <AlertDescription className="text-green-700 dark:text-green-400">
                            You are within {locations.find(l => l.id === selectedLocationId)?.name || 'selected location'}. 
                            You can now mark your attendance.
                          </AlertDescription>
                        </Alert>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Location Permission Status */}
                  {locationPermission === 'denied' && (
                    <Alert variant="destructive" className="mt-4">
                      <FaExclamationTriangle className="h-4 w-4" />
                      <AlertTitle>Location Access Denied</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>You need to enable location access to verify your location.</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setShowPermissionDialog(true)}
                          className="mt-2"
                        >
                          <FaLocationArrow className="mr-2 h-4 w-4" />
                          Show Instructions
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No locations available. Please contact your administrator.
              </p>
            )}
          </div>

          {/* Current Attendance Status & Live Shift Countdown */}
          <AnimatePresence mode="wait">
            {currentAttendance && (
              <motion.div 
                initial={{ height: 0, opacity: 0, scale: 0.95 }}
                animate={{ height: 'auto', opacity: 1, scale: 1 }}
                exit={{ height: 0, opacity: 0, scale: 0.95 }}
                className="overflow-hidden space-y-3"
              >
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
                      <FaSignInAlt className="h-5 w-5" />
                      <span>Currently checked in</span>
                    </div>
                    {isProximityMonitoring && (
                      <Badge className="bg-emerald-600 text-white flex items-center gap-1.5 px-2.5 py-1 text-xs">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                        Proximity Gate Active
                      </Badge>
                    )}
                  </div>

                  <div className="mt-2 text-sm">
                    <div className="font-bold text-lg flex items-center">
                      <span className={`w-3 h-3 rounded-full mr-2 ${getLocationColor(currentAttendance.location?.name || 'Office Location').dot}`} />
                      {currentAttendance.location?.name || 'Office Location'}
                    </div>
                    <p className="text-muted-foreground mt-1">
                      Since {formatDate(currentAttendance.checkInTime)}
                    </p>
                  </div>

                  {/* Shift Timer & Auto Check-Out Information */}
                  {shiftInfo?.hasShift && (
                    <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800/50 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Roster Shift: {shiftInfo.shiftName || 'Standard'} ({shiftInfo.rosterStartTime} - {shiftInfo.rosterEndTime})
                        </span>
                        {shiftInfo.hasApprovedOT ? (
                          <Badge className="bg-indigo-600 text-white text-[10px]">
                            OT Approved (Auto-Checkout Bypassed)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-500 dark:text-amber-400 text-[10px]">
                            Auto Check-Out at {shiftInfo.rosterEndTime}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between bg-white dark:bg-slate-800/80 p-2.5 rounded-md border border-green-100 dark:border-slate-700">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          Shift Time Remaining:
                        </span>
                        <span className={`font-mono text-base font-bold ${shiftTimerSeconds <= 300 && !shiftInfo.hasApprovedOT ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-slate-800 dark:text-slate-100'}`}>
                          {formatCountdown(shiftTimerSeconds)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
        <CardFooter className="pt-0">
          {currentAttendance ? (
            <Button
              onClick={handleCheckOut}
              disabled={loading || !checkOutLocationVerified || locationPermission === 'denied'}
              className="w-full py-6 text-lg"
              variant="destructive"
              size="lg"
            >
              {loading ? (
                <FaSpinner className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <FaSignOutAlt className="mr-2 h-5 w-5" />
              )}
              Check Out
            </Button>
          ) : (
            <Button
              onClick={handleCheckIn}
              disabled={loading || locations.length === 0 || !locationVerified || locationPermission === 'denied'}
              className="w-full py-6 text-lg"
              size="lg"
            >
              {loading ? (
                <FaSpinner className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <FaSignInAlt className="mr-2 h-5 w-5" />
              )}
              Check In
            </Button>
          )}
        </CardFooter>
      </Card>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="shadow-sm border-none sm:border-solid">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-xl">Recent Attendance</CardTitle>
            <CardDescription>
              Your attendance records and history
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn(
                  "h-9 px-3 rounded-xl border-slate-200 dark:border-slate-800",
                  dateRange?.from && "border-primary text-primary bg-primary/5"
                )}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd")
                    )
                  ) : (
                    "Filter"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-slate-200 dark:border-slate-800" align="end">
                <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-sm font-bold">Select Date Range</span>
                  {dateRange && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setDateRange(undefined)}
                      className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <X className="h-3 w-3 mr-1" /> Clear
                    </Button>
                  )}
                </div>
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={1}
                />
              </PopoverContent>
            </Popover>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={generatePDFReport}
              disabled={generatingPDF || filteredHistory.length === 0}
              className="h-9 px-3 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-primary/5 hover:text-primary hover:border-primary/30"
            >
              {generatingPDF ? (
                <FaSpinner className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {attendanceLoading ? (
            <div className="flex justify-center py-4">
              <FaSpinner className="animate-spin h-5 w-5 text-primary" />
            </div>
          ) : filteredHistory.length > 0 ? (
            <div className="space-y-3">
              {(dateRange ? filteredHistory : filteredHistory.slice(0, 5)).map((attendance) => (
                <div key={attendance.id} className="border rounded-xl p-3 sm:p-4 hover:bg-muted/30 transition-all active:scale-[0.98]">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm sm:text-base truncate">{attendance.location?.name || 'Office Location'}</h4>
                      <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-tight">
                        {formatDate(attendance.checkInTime).split(',')[0]}
                      </p>
                    </div>
                    <div className="ml-2">
                      <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full ${
                        (attendance.status === 'COMPLETED' || (attendance.checkOutTime && attendance.status !== 'ABSENT' && attendance.status !== 'ON LEAVE' && attendance.status !== 'OFF DAY')) ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' :
                        (attendance.status === 'Currently Not Checked Out' || attendance.status === 'IN PROGRESS' || (!attendance.checkOutTime && attendance.status !== 'ABSENT' && attendance.status !== 'ON LEAVE' && attendance.status !== 'OFF DAY')) ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                        (attendance.status === 'OFF DAY' || attendance.status === 'ABSENT') ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}>
                        {attendance.status === 'ON LEAVE' ? 'ON LEAVE' : (attendance.status === 'OFF DAY' || attendance.status === 'ABSENT') ? 'OFF DAY' : !attendance.checkOutTime ? 'Currently Not Checked Out' : 'COMPLETED'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-dashed">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase block">In</span>
                      <span className="text-xs font-medium truncate block">
                        {formatDate(attendance.checkInTime).split(',')[2] || formatDate(attendance.checkInTime).split(',')[1]}
                      </span>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <span className="text-[10px] text-muted-foreground uppercase block">Out</span>
                      <span className="text-xs font-medium truncate block">
                        {attendance.checkOutTime 
                          ? (formatDate(attendance.checkOutTime).split(',')[2] || formatDate(attendance.checkOutTime).split(',')[1]) 
                          : 'Pending'}
                      </span>
                    </div>
                    <div className="col-span-2 pt-2 flex justify-between items-center text-[10px] sm:text-xs bg-muted/50 p-1.5 rounded-md">
                      <span className="text-muted-foreground">Total Duration</span>
                      <span className="font-bold text-primary">{calculateDuration(attendance.checkInTime, attendance.checkOutTime)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-4 text-muted-foreground">
              No attendance records found
            </p>
          )}
        </CardContent>
      </Card>
      </motion.div>
    </div>
  );
};

export default AttendanceCheckInOut;