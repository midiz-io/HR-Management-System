import { createBrowserClient } from '@supabase/ssr'

/**
 * Safely create a Supabase browser client.
 *
 * If the required environment variables are missing, we return a
 * very small "mock" client instead of throwing during render. This
 * prevents the whole Next.js app from crashing with a 500 error
 * while still making it obvious at interaction time that Supabase
 * is not configured.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If env vars are missing, avoid calling createBrowserClient
  // (which throws) and return a minimal mock client.
  if (!url || !anonKey) {
    if (process.env.NODE_ENV !== 'production') {
      // Helpful message in the dev console without breaking the UI.
      // You still need to set NEXT_PUBLIC_SUPABASE_URL and
      // NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.
      // See: https://supabase.com/dashboard/project/_/settings/api
      console.error(
        '@supabase/ssr: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
          'Auth features will be disabled until these are set.'
      )
    }

    const notConfiguredError = () =>
      new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')

    // Very small subset of the Supabase client surface used in AuthContext.
    const mockClient = {
      auth: {
        // Used on initial load
        async getUser() {
          return { data: { user: null }, error: null }
        },
        // Used to subscribe to auth state changes
        onAuthStateChange() {
          return {
            data: {
              subscription: {
                // No-op unsubscribe so cleanup in AuthContext works
                unsubscribe() {},
              },
            },
            error: null,
          }
        },
        async signInWithPassword() {
          const error = notConfiguredError()
          return { data: null, error }
        },
        async signUp() {
          const error = notConfiguredError()
          return { data: { user: null }, error }
        },
        async signInWithOtp() {
          const error = notConfiguredError()
          return { data: { user: null }, error }
        },
        async signInWithOAuth() {
          const error = notConfiguredError()
          return { data: null, error }
        },
        async signOut() {
          const error = notConfiguredError()
          return { error }
        },
        async resetPasswordForEmail() {
          const error = notConfiguredError()
          return { data: null, error }
        },
      },
    } as any

    return mockClient
  }

  const supabase = createBrowserClient(url, anonKey, {
    cookieOptions: {
      domain: process.env.NEXT_PUBLIC_CO_DEV_ENV === 'preview' ? '.preview.co.dev' : undefined,
    },
  })

  return supabase
}