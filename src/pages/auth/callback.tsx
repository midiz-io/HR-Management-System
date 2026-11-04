import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@/util/supabase/component'
import { useAuth } from '@/contexts/AuthContext'

export default function AuthCallback() {
  const router = useRouter()
  const supabase = createClient()
  const { createUser } = useAuth();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          await createUser(session.user);
          
          // Check user role using the API endpoint instead of direct Supabase query
          const response = await fetch('/api/user');
          if (!response.ok) {
            throw new Error('Failed to fetch user data');
          }
          
          const userData = await response.json();
          
          if (userData && userData.role === 'ADMIN') {
            router.push('/admin-dashboard');
          } else {
            router.push('/dashboard');
          }
        } catch (error) {
          console.error('Error in auth callback:', error);
          router.push('/dashboard');
        }
      }
    });

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router, createUser, supabase])

  return null
}