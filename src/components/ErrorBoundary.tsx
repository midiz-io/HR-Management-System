import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Trash2, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught client exception caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleClearCacheAndReload = async () => {
    try {
      if (typeof window !== 'undefined') {
        // Clear caches
        if ('caches' in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map(k => caches.delete(k)));
        }
        // Unregister service workers
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
        // Reload hard
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 selection:bg-rose-500 selection:text-white">
          <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-md border border-slate-700/60 rounded-2xl p-6 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight text-white">Something Went Wrong</h1>
              <p className="text-xs text-slate-300 leading-relaxed">
                A client-side update conflict or script error occurred. Purging old browser cache and reloading will resolve this immediately.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-slate-950/60 border border-slate-800 rounded-xl p-3 max-h-36 overflow-y-auto text-[11px] font-mono text-rose-300">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-2">
              <Button
                onClick={this.handleClearCacheAndReload}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl gap-2 shadow-lg shadow-indigo-600/25"
              >
                <RefreshCw className="w-4 h-4" />
                Clear Cache & Refresh App
              </Button>
              <Button
                variant="outline"
                onClick={() => { window.location.href = '/'; }}
                className="w-full h-10 border-slate-700 text-slate-300 hover:bg-slate-700/50 hover:text-white rounded-xl gap-2"
              >
                <Home className="w-4 h-4" />
                Return to Login
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
