import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, AppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LogOut, MapPin, CheckCircle2, Clock } from 'lucide-react-native';
import { LOCATION_TASK_NAME } from '../tasks/locationTask';

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [locationName, setLocationName] = useState('Loading...');
  const [status, setStatus] = useState('OUTSIDE'); // 'OUTSIDE', 'INSIDE', 'CHECKED_IN'

  useEffect(() => {
    setupBackgroundTracking();
    fetchUserData();
  }, []);

  async function fetchUserData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user data from our Prisma DB using Supabase directly 
      // (Since it's the same DB, we can query public tables if RLS allows, 
      // otherwise hit the Next.js API). Let's hit Supabase directly.
      const { data: userData, error } = await supabase
        .from('User')
        .select('firstName, lastName, locationId, Location(name, latitude, longitude, radius)')
        .eq('id', user.id)
        .single();

      if (userData) {
        setUserName(userData.firstName || 'User');
        if (userData.Location) {
          setLocationName(userData.Location.name);
          // Cache location for background task
          await AsyncStorage.setItem('assigned_location', JSON.stringify({
            id: userData.locationId,
            latitude: userData.Location.latitude,
            longitude: userData.Location.longitude,
            radius: userData.Location.radius || 100
          }));
        }
      }

      // Check if already checked in today
      const todayStr = new Date().toISOString().split('T')[0];
      const lastCheckin = await AsyncStorage.getItem('last_checkin_date');
      if (lastCheckin === todayStr) {
        setStatus('CHECKED_IN');
      }

    } catch (e) {
      console.log('Error fetching user data', e);
    } finally {
      setLoading(false);
    }
  }

  async function setupBackgroundTracking() {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      Alert.alert('Permission denied', 'Location permission is required.');
      return;
    }
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      Alert.alert('Permission denied', 'Background location is required for auto check-in.');
      return;
    }

    const isRegistered = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (!isRegistered) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 60000, // Check every 60 seconds
        distanceInterval: 50, // Or every 50 meters
        deferredUpdatesInterval: 60000,
        showsBackgroundLocationIndicator: true,
      });
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {userName}</Text>
          <Text style={styles.dateText}>{new Date().toDateString()}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <LogOut size={24} color="#dc2626" />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MapPin size={24} color="#3b82f6" />
          <Text style={styles.cardTitle}>Assigned Location</Text>
        </View>
        <Text style={styles.locationText}>{locationName}</Text>
      </View>

      <View style={styles.statusContainer}>
        {status === 'CHECKED_IN' ? (
          <View style={[styles.statusCircle, { backgroundColor: '#10b981' }]}>
            <CheckCircle2 size={64} color="#ffffff" />
            <Text style={styles.statusText}>Checked In</Text>
          </View>
        ) : (
          <View style={[styles.statusCircle, { backgroundColor: '#f59e0b' }]}>
            <Clock size={64} color="#ffffff" />
            <Text style={styles.statusText}>Tracking...</Text>
            <Text style={styles.trackingSubtext}>Walk into office to auto check-in</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 24,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  dateText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 4,
  },
  logoutBtn: {
    padding: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 40,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginLeft: 8,
  },
  locationText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCircle: {
    width: 280,
    height: 280,
    borderRadius: 140,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  statusText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 16,
  },
  trackingSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 30,
  }
});
