import React, { createContext, useState, ReactNode, useContext, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/util/supabase/component';
import { User, Provider } from '@supabase/supabase-js';
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from 'next/router';

interface AuthContextType {
  user: User | null;
  createUser: (user: User, role?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<User | null>;
  signUp: (email: string, password: string, role?: string) => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  initializing: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  createUser: async () => {},
  signIn: async () => null,
  signUp: async () => {},
  signInWithMagicLink: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
  resetPassword: async () => {},
  initializing: false
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;

    const fetchSession = async () => {
      try {
        // Fast path: read cached session from storage/cookie first for instant UI render
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted && session?.user) {
          setUser(session.user);
          setInitializing(false);
          return;
        }

        const { data: { user: remoteUser } } = await supabase.auth.getUser();
        if (mounted) {
          setUser(remoteUser);
          setInitializing(false);
        }
      } catch {
        if (mounted) {
          setInitializing(false);
        }
      }
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
      setTimeout(() => {
        if (mounted) {
          setUser(session?.user ?? null);
          setInitializing(false);
        }
      }, 0);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const createUser = useCallback(async (user: User, role: string = 'EMPLOYEE') => {
    try {
      // Use the API endpoint with direct user authorization header
      const response = await fetch('/api/user', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': user.id,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to create or fetch user profile');
      }
      
      if (role !== 'EMPLOYEE') {
        const updateResponse = await fetch('/api/user', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': user.id,
          },
          body: JSON.stringify({ role }),
        });
        
        if (!updateResponse.ok) {
          throw new Error('Failed to update user role');
        }
      }
    } catch (error) {
      console.error('Error in createUser:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create user profile",
      });
    }
  }, [toast]);

  const signIn = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (!error && data?.user) {
      await createUser(data.user);
    }
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      throw error;
    } else {
      toast({
        title: "Success",
        description: "You have successfully signed in",
      });
    }
    return data?.user ?? null;
  }, [supabase, createUser, toast]);

  const signUp = useCallback(async (email: string, password: string, role: string = 'EMPLOYEE') => {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password
    });

    if (error) {
      if (error.status === 422 && error.message.includes('already registered')) {
        toast({
          title: "Account exists",
          description: "This email is already registered. Please log in instead.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      }
      throw error;
    }

    if (data.user) {
      await createUser(data.user, role);
    }

    toast({
      title: "Success",
      description: "Sign up successful! Please login to continue.",
    });
  }, [supabase, createUser, toast]);

  const signInWithMagicLink = useCallback(async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    
    if (error) {
      if (error.message.includes('user not found')) {
        toast({
          title: "User not found",
          description: "We'll send you a sign-up link instead.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
        throw error;
      }
    } else {
      if (data.user) {
        await createUser(data.user);
      }
      
      toast({
        title: "Success",
        description: "Check your email for the login link",
      });
    }
  }, [supabase, createUser, toast]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google' as Provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      throw error;
    }
  }, [supabase, toast]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      toast({
        title: "Success",
        description: "You have successfully signed out",
      });
      router.push('/');
    }
  }, [supabase, toast, router]);

  const resetPassword = useCallback(async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      throw error;
    } else {
      toast({
        title: "Success",
        description: "Check your email for the password reset link",
      });
    }
  }, [supabase, toast]);

  const contextValue = useMemo(() => ({
    user,
    createUser,
    signIn,
    signUp,
    signInWithMagicLink,
    signInWithGoogle,
    signOut,
    resetPassword,
    initializing,
  }), [user, createUser, signIn, signUp, signInWithMagicLink, signInWithGoogle, signOut, resetPassword, initializing]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
