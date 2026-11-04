import React, { useState, useEffect } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import prisma from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';
import { 
  FaClock, 
  FaDoorOpen, 
  FaCheckCircle, 
  FaExclamationTriangle, 
  FaArrowLeft, 
  FaSpinner, 
  FaUserAlt,
  FaCalendarAlt,
  FaSignOutAlt
} from 'react-icons/fa';
import { format, differenceInSeconds } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface GatePassProps {
  gatePass?: {
    id: string;
    date: string;
    timeOut: string;
    expectedTimeIn: string;
    purpose: string;
    status: 'PENDING_SECTIONAL_HEAD' | 'PENDING_HR' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'RETURNED' | 'NOT_RETURNED';
    returnedAt: string | null;
    user: {
      firstName: string;
      lastName: string;
      department: string;
      position: string;
      profileImage: string | null;
    };
    checkout: {
      actualTimeOut: string;
    } | null;
  };
  error?: string;
}

export default function GatePassPublicPage({ gatePass: initialGatePass, error }: GatePassProps) {
  const [gatePass, setGatePass] = useState(initialGatePass);
  const [checkingOut, setCheckingOut] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [timerType, setTimerType] = useState<'COUNTDOWN' | 'OVERDUE' | 'COMPLETED'>('COUNTDOWN');
  const [secondsDiff, setSecondsDiff] = useState<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    if (error || !gatePass) return;

    // Automatically trigger checkout registration if not already done
    const performCheckout = async () => {
      if (gatePass.status === 'APPROVED' && !gatePass.checkout) {
        setCheckingOut(true);
        try {
          const response = await fetch('/api/requests/gate-pass/checkout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: gatePass.id }),
          });
          
          const data = await response.json();
          if (response.ok) {
            setGatePass(data.request);
            toast({
              title: 'Departure Registered',
              description: 'Your actual time out has been recorded at the gate.',
            });
          } else {
            console.warn('Auto-checkout failed:', data.error);
          }
        } catch (e) {
          console.error('Checkout error:', e);
        } finally {
          setCheckingOut(false);
        }
      }
    };

    performCheckout();
  }, [error]);

  // Timer Tick Logic
  useEffect(() => {
    if (!gatePass) return;

    const interval = setInterval(() => {
      // 1. If returned, timer is completed
      if (gatePass.status === 'RETURNED' || gatePass.returnedAt) {
        setTimerType('COMPLETED');
        setTimeRemaining('Returned');
        setSecondsDiff(0);
        clearInterval(interval);
        return;
      }

      // 2. We can only count down if they have checked out (actualTimeOut is recorded)
      const checkoutTimeStr = gatePass.checkout?.actualTimeOut;
      if (!checkoutTimeStr) {
        setTimerType('COUNTDOWN');
        setTimeRemaining('--:--:--');
        setSecondsDiff(0);
        return;
      }

      // Compute target return date
      const gatePassDate = new Date(gatePass.date);
      const [hours, minutes] = gatePass.expectedTimeIn.split(':').map(Number);
      const targetDate = new Date(
        gatePassDate.getFullYear(),
        gatePassDate.getMonth(),
        gatePassDate.getDate(),
        hours,
        minutes,
        0
      );

      const now = new Date();
      const diff = differenceInSeconds(targetDate, now);
      setSecondsDiff(diff);

      if (diff > 0) {
        setTimerType('COUNTDOWN');
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        setTimeRemaining(`${h}:${m}:${s}`);
      } else {
        setTimerType('OVERDUE');
        const absDiff = Math.abs(diff);
        const h = Math.floor(absDiff / 3600).toString().padStart(2, '0');
        const m = Math.floor((absDiff % 3600) / 60).toString().padStart(2, '0');
        const s = (absDiff % 60).toString().padStart(2, '0');
        setTimeRemaining(`${h}:${m}:${s}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gatePass]);

  if (error || !gatePass) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
        <Head>
          <title>Error - Gate Pass Verify</title>
        </Head>
        <Card className="w-full max-w-md border-destructive/20 shadow-xl rounded-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
              <FaExclamationTriangle className="w-8 h-8" />
            </div>
            <CardTitle className="text-2xl font-black">Gate Pass Error</CardTitle>
            <CardDescription className="text-sm font-bold uppercase tracking-widest text-red-500">
              {error || 'Request Not Found'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground font-medium mb-6">
              The requested Gate Pass is either invalid, expired, or has not been authorized. Please check your dashboard or contact administration.
            </p>
            <Button onClick={() => window.location.href = '/dashboard'} className="w-full rounded-xl">
              <FaArrowLeft className="mr-2" /> Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600 font-bold px-3 py-1 rounded-full">APPROVED</Badge>;
      case 'RETURNED':
        return <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 font-bold px-3 py-1 rounded-full">RETURNED</Badge>;
      case 'NOT_RETURNED':
        return <Badge variant="destructive" className="font-bold px-3 py-1 rounded-full">OVERDUE</Badge>;
      default:
        return <Badge variant="secondary" className="font-bold px-3 py-1 rounded-full">{status.replace(/_/g, ' ')}</Badge>;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4 font-sans text-slate-900 dark:text-slate-100 selection:bg-blue-500/20">
      <Head>
        <title>Gate Pass Countdown - {gatePass.user.firstName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <div className="w-full max-w-md space-y-6">
        {/* Banner for live checking out */}
        <AnimatePresence>
          {checkingOut && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-blue-500 text-white p-3 rounded-2xl flex items-center justify-center gap-2 font-semibold text-xs shadow-md shadow-blue-500/10"
            >
              <FaSpinner className="animate-spin" />
              Verifying exit checkout with gate console...
            </motion.div>
          )}
        </AnimatePresence>

        <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-100 dark:border-slate-800">
          <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-600" />
          <CardHeader className="text-center pb-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">AttendX Portal</span>
              {getStatusBadge(gatePass.status)}
            </div>
            
            {/* User Profile Info */}
            <div className="flex flex-col items-center mb-2">
              <div className="w-20 h-20 rounded-full border-4 border-white dark:border-slate-800 shadow-md bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center text-slate-400">
                {gatePass.user.profileImage ? (
                  <img src={gatePass.user.profileImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <FaUserAlt className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                )}
              </div>
              <h1 className="text-xl font-black mt-3 leading-tight">
                {gatePass.user.firstName} {gatePass.user.lastName}
              </h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary mt-1">
                {gatePass.user.department} • {gatePass.user.position}
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 px-6 pb-8">
            {/* Real-time Countdown Timer Frame */}
            <div className="relative p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-950 dark:to-slate-900/50 border border-slate-200/50 dark:border-slate-800 text-center shadow-inner overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full filter blur-xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/5 rounded-full filter blur-xl" />
              
              <span className="text-[9px] font-black tracking-widest text-muted-foreground/60 uppercase block mb-1">
                {timerType === 'COUNTDOWN' && 'REMAINING TIME OUT'}
                {timerType === 'OVERDUE' && 'OVERDUE TIME OUT'}
                {timerType === 'COMPLETED' && 'GATE PASS COMPLETED'}
              </span>

              <AnimatePresence mode="wait">
                <motion.div
                  key={timerType}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`text-5xl font-black tracking-tight ${
                    timerType === 'COUNTDOWN' ? 'text-blue-600 dark:text-blue-400' : 
                    timerType === 'OVERDUE' ? 'text-red-500 animate-pulse' : 
                    'text-emerald-500'
                  }`}
                >
                  {timeRemaining || '--:--:--'}
                </motion.div>
              </AnimatePresence>

              {timerType === 'OVERDUE' && (
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block mt-2 flex items-center justify-center gap-1.5 animate-bounce">
                  <FaExclamationTriangle className="h-3 w-3" /> Exceeded Return expected time
                </span>
              )}
              {timerType === 'COMPLETED' && (
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block mt-2 flex items-center justify-center gap-1.5">
                  <FaCheckCircle className="h-3 w-3" /> Returned inside premises
                </span>
              )}
            </div>

            {/* Check Out and expected return details */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-bold uppercase flex items-center gap-1.5">
                  <FaCalendarAlt className="text-slate-400 dark:text-slate-600 h-3.5 w-3.5" /> Date
                </span>
                <span className="font-bold">{format(new Date(gatePass.date), 'MMMM dd, yyyy')}</span>
              </div>
              
              <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-900 pt-3">
                <span className="text-xs text-muted-foreground font-bold uppercase flex items-center gap-1.5">
                  <FaSignOutAlt className="text-slate-400 dark:text-slate-600 h-3.5 w-3.5" /> Actual Checkout
                </span>
                <span className="font-black text-blue-600 dark:text-blue-400">
                  {gatePass.checkout ? format(new Date(gatePass.checkout.actualTimeOut), 'HH:mm') : 'Waiting for scan...'}
                </span>
              </div>

              <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-900 pt-3">
                <span className="text-xs text-muted-foreground font-bold uppercase flex items-center gap-1.5">
                  <FaClock className="text-slate-400 dark:text-slate-600 h-3.5 w-3.5" /> Expected Return
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {gatePass.expectedTimeIn || '-'}
                </span>
              </div>

              {gatePass.returnedAt && (
                <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-900 pt-3 text-emerald-600 dark:text-emerald-400 font-bold">
                  <span className="text-xs font-bold uppercase flex items-center gap-1.5">
                    <FaCheckCircle className="h-3.5 w-3.5" /> Actual Return
                  </span>
                  <span>
                    {format(new Date(gatePass.returnedAt), 'HH:mm')}
                  </span>
                </div>
              )}
            </div>

            {/* Purpose */}
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground font-black uppercase tracking-widest block">Purpose of Exit</span>
              <p className="p-3 bg-slate-100/50 dark:bg-slate-950/30 rounded-xl text-sm leading-relaxed border border-slate-200/20 italic">
                "{gatePass.purpose}"
              </p>
            </div>

            {/* Return Button redirecting to dashboard */}
            <Button 
              onClick={() => window.location.href = '/dashboard'} 
              variant="outline" 
              className="w-full rounded-2xl h-12 hover:bg-slate-50 dark:hover:bg-slate-950 font-bold border-slate-200 dark:border-slate-800"
            >
              Go to Employee Portal
            </Button>
          </CardContent>
        </Card>
      </div>
      <Toaster />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params || {};

  if (!id || typeof id !== 'string') {
    return { props: { error: 'Invalid Gate Pass ID' } };
  }

  try {
    const gatePass = await prisma.gatePassRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            department: true,
            position: true,
            profileImage: true
          }
        },
        checkout: true
      }
    });

    if (!gatePass) {
      return { props: { error: 'Gate Pass request not found.' } };
    }

    return {
      props: {
        gatePass: JSON.parse(JSON.stringify(gatePass))
      }
    };
  } catch (error) {
    console.error('Error fetching gate pass:', error);
    return { props: { error: 'Failed to retrieve gate pass details' } };
  }
};
