import type { AppProps } from 'next/app'
import { AuthProvider } from '@/contexts/AuthContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { RealtimeProvider } from '@/contexts/RealtimeContext'
import '../styles/globals.css';
import { ThemeProvider } from '@/contexts/ThemeContext'; // Add this import
import '../styles/mobile-enhancements.css';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Toaster } from "@/components/ui/toaster"
import Head from 'next/head';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, minimum-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-touch-fullscreen" content="yes" />
      </Head>
      {/* Register service worker for PWA when available */}
      <ServiceWorkerRegister />
      <div className="min-h-screen mobile-safe-top mobile-safe-bottom">
        <ThemeProvider>
          <AuthProvider>
            <RealtimeProvider>
              <NotificationProvider>
                <ErrorBoundary>
                  <ProtectedRoute>
                    <Component {...pageProps} />
                  </ProtectedRoute>
                </ErrorBoundary>
                <Toaster />
              </NotificationProvider>
            </RealtimeProvider>
          </AuthProvider>
        </ThemeProvider>
      </div>
    </>
  )
}