import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { MapPin, Mail, Lock } from 'lucide-react-native';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signInWithEmail() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) Alert.alert('Authentication Failed', error.message);
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.topSection}>
        <View style={styles.iconContainer}>
          <MapPin size={48} color="#ffffff" strokeWidth={2.5} />
        </View>
        <Text style={styles.title}>AttendX</Text>
        <Text style={styles.subtitle}>Automated Workspace Sync</Text>
      </View>

      <View style={styles.bottomSection}>
        <Text style={styles.welcomeText}>Welcome back</Text>
        <Text style={styles.instructionText}>Enter your credentials to continue</Text>

        <View style={styles.inputContainer}>
          <Mail size={20} color="#94a3b8" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="#94a3b8"
            onChangeText={setEmail}
            value={email}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputContainer}>
          <Lock size={20} color="#94a3b8" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#94a3b8"
            onChangeText={setPassword}
            value={password}
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={signInWithEmail} 
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#dc2626', // Deep red matching AttendX theme
  },
  topSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  iconContainer: {
    width: 96,
    height: 96,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bottomSection: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 60,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#dc2626',
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
