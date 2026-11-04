import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LOCATION_TASK_NAME = 'background-location-task';

// Define the background task for location
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Task error:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (!locations || locations.length === 0) return;

    const currentLocation = locations[0];
    
    try {
      // 1. Get authenticated user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return; // Not logged in

      // 2. We need the user's assigned Location (Office) geofence details
      // In a real app, this should be cached locally to avoid querying on every background tick.
      const cachedLocationStr = await AsyncStorage.getItem('assigned_location');
      if (!cachedLocationStr) return;
      
      const assignedLocation = JSON.parse(cachedLocationStr);
      if (!assignedLocation || !assignedLocation.latitude || !assignedLocation.longitude) return;

      // 3. Check distance to Geofence
      const R = 6371e3; // metres
      const φ1 = currentLocation.coords.latitude * Math.PI/180;
      const φ2 = assignedLocation.latitude * Math.PI/180;
      const Δφ = (assignedLocation.latitude - currentLocation.coords.latitude) * Math.PI/180;
      const Δλ = (assignedLocation.longitude - currentLocation.coords.longitude) * Math.PI/180;

      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;

      const GEOFENCE_RADIUS = assignedLocation.radius || 100; // default 100m

      if (distance <= GEOFENCE_RADIUS) {
        // User is inside the geofence!
        // Call the check-in API or insert directly to Supabase if shift is active
        
        // Check if already checked in today to avoid spamming
        const todayStr = new Date().toISOString().split('T')[0];
        const lastCheckin = await AsyncStorage.getItem('last_checkin_date');
        
        if (lastCheckin !== todayStr) {
          // Trigger check-in via API (We hit the NextJS backend to ensure robust validation)
          // Since we need the full API URL, it should be in .env
          const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
          
          await fetch(`${apiUrl}/api/admin/attendance`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              userId: session.user.id,
              locationId: assignedLocation.id,
              checkInTime: new Date().toISOString(),
              status: 'PRESENT',
              notes: 'Auto checked in via Mobile Background Geofence'
            })
          });

          await AsyncStorage.setItem('last_checkin_date', todayStr);
          console.log("Automatically checked in user!");
        }
      }
    } catch (e) {
      console.error("Background task exception:", e);
    }
  }
});
