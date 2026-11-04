import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import GateQRScanner from '@/components/GateQRScanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { QrCode, Lock, Key, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GateScannerPage() {
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [passcode, setPasscode] = useState<string>('');
  const [verifying, setVerifying] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if passcode is already stored
    const storedPasscode = localStorage.getItem('gateScannerPasscode');
    if (storedPasscode === 'HR') {
      setPasscode(storedPasscode);
      setUnlocked(true);
    }
  }, []);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);

    // Mock passcode verification matching admin panel (HR)
    setTimeout(() => {
      if (passcode === 'HR') {
        localStorage.setItem('gateScannerPasscode', passcode);
        setUnlocked(true);
        toast({
          title: 'Access Granted',
          description: 'Gate scanner terminal unlocked successfully.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Access Denied',
          description: 'Incorrect passcode. Please try again.',
        });
        setPasscode('');
      }
      setVerifying(false);
    }, 600);
  };

  const handleLock = () => {
    localStorage.removeItem('gateScannerPasscode');
    setPasscode('');
    setUnlocked(false);
  };

  return (
    <>
      <Head>
        <title>Gate QR Scanner - AttendX</title>
        <meta name="description" content="AttendX Gate QR Scanner Terminal" />
        <link rel="manifest" href="/gate-scanner-manifest.json" />
        <meta name="theme-color" content="#020617" />
        <link rel="apple-touch-icon" href="/images/logo.png" />
      </Head>

      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-primary/20 relative overflow-hidden">
        {/* Decorative Grid Watermark Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-60 pointer-events-none" />

        {/* Top Header */}
        <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md py-4 px-6 flex justify-between items-center z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-inner">
              <QrCode className="text-primary-foreground w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-none">AttendX Gate Terminal</h1>
              <p className="text-[9px] text-primary font-bold uppercase tracking-widest mt-1">Autonomous Scanning</p>
            </div>
          </div>

          {unlocked && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLock}
              className="rounded-xl h-8 border-slate-800 bg-slate-900 hover:bg-slate-800 hover:text-white"
            >
              <Lock className="h-3.5 w-3.5 mr-2" /> Lock Terminal
            </Button>
          )}
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex items-center justify-center p-6 z-10">
          <AnimatePresence mode="wait">
            {!unlocked ? (
              <motion.div
                key="lockscreen"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-md"
              >
                <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
                  <CardHeader className="text-center pt-8 pb-4">
                    <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
                      <Lock className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight text-white">Terminal Locked</CardTitle>
                    <CardDescription className="text-slate-400">
                      Enter the security passcode to activate the Gate QR Scanner.
                    </CardDescription>
                  </CardHeader>
                  <form onSubmit={handleUnlock}>
                    <CardContent className="space-y-4 px-6">
                      <div className="space-y-2">
                        <div className="relative">
                          <Key className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                          <Input
                            type="password"
                            placeholder="Enter Gate Passcode"
                            value={passcode}
                            onChange={(e) => setPasscode(e.target.value)}
                            disabled={verifying}
                            className="pl-9 h-10 rounded-xl border-slate-800 bg-slate-950 text-white placeholder-slate-600 focus-visible:ring-primary/20"
                            autoFocus
                          />
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="px-6 pb-8">
                      <Button
                        type="submit"
                        disabled={verifying || !passcode}
                        className="w-full h-10 rounded-xl font-bold transition-all shadow-lg shadow-primary/25"
                      >
                        {verifying ? (
                          'Verifying passcode...'
                        ) : (
                          <>
                            Activate Terminal <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </form>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="scanner"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="w-full"
              >
                <div className="max-w-7xl mx-auto w-full">
                  <GateQRScanner passcode={passcode} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="py-4 px-6 border-t border-slate-900 bg-slate-950 text-center text-[10px] font-bold tracking-widest text-slate-600 z-10 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> SECURED GATE TERMINAL
          </span>
          <span>© {new Date().getFullYear()} ATTENDX INC. ALL RIGHTS RESERVED.</span>
        </footer>
      </div>

      <Toaster />
    </>
  );
}
