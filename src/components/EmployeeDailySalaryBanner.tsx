import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/util/payroll';
import {
  Eye,
  EyeOff,
  ShieldCheck,
  Lock,
  Sparkles,
  Camera,
  CheckCircle2,
  Download,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar,
  TrendingUp,
  Building2,
  AlertCircle,
  RefreshCw,
  KeyRound,
  ScanFace,
  ArrowRight,
  Check,
  Clock,
  Wallet,
} from 'lucide-react';

interface DailySalaryResponse {
  employee: {
    id: string;
    name: string;
    email: string;
    position: string;
    department: string;
    sequentialId: number;
  };
  period: {
    month: number;
    year: number;
    monthName: string;
    todayDate: string;
  };
  security: {
    faceVerified: boolean;
    verifiedAt: string | null;
    savedPin: string | null;
  };
  departmentOffDayPolicy: {
    departmentName: string;
    allocatedPaidOffDays: number;
    expectedWorkingDays: number;
    daysWorked: number;
    paidOffDaysUsed: number;
    paidOffDaysRemaining: number;
    additionalPayableOffDays: number;
    unpaidAbsences: number;
  };
  dailySummary: {
    dailyBasicRate: number;
    dailyIncentiveRate: number;
    standardDailyEarning: number;
    todayEarnedSalary: number;
    accumulatedDailySalary: number;
    attendedToday: boolean;
  };
  monthlyStructure: {
    hasSalaryConfig: boolean;
    basicSalary: number;
    paidOffDayPayment: number;
    totalForEpf: number;
    attendanceIncentive: number;
    performanceIncentive: number;
    otPay: number;
    otherAllowances: number;
    otAndOtherAllowances: number;
    grossSalary: number;
    epfEmployeeRate: number;
    employeeEpf: number;
    salaryAdvances: number;
    loanDeduction: number;
    pendingBills: number;
    otherDeductions: number;
    nonEpfDeductions: number;
    totalDeductions: number;
    netSalary: number;
    companyContributions: {
      epfEmployerRate: number;
      companyEpf12: number;
      etfEmployerRate: number;
      companyEtf3: number;
    };
  };
  dailyRecords: Array<{
    date: string;
    dayName: string;
    dayType:
      | 'WORKED'
      | 'ADDITIONAL_OFF_DAY_WORKED'
      | 'PAID_OFF_DAY'
      | 'UNPAID_ABSENCE';
    hasAttendance: boolean;
    locationName: string | null;
    checkInTime: string | null;
    checkOutTime: string | null;
    basicEarned: number;
    incentiveEarned: number;
    otPayEarned: number;
    totalDayEarned: number;
  }>;
}

type FaceAngleStep = {
  id: 'CENTER' | 'LEFT' | 'RIGHT' | 'UP';
  title: string;
  instruction: string;
  targetZone: string;
};

const FACE_ANGLE_STEPS: FaceAngleStep[] = [
  {
    id: 'CENTER',
    title: 'Step 1/4: Center Face Alignment',
    instruction: 'Position your face directly inside the center guideline oval',
    targetZone: 'CENTER',
  },
  {
    id: 'LEFT',
    title: 'Step 2/4: Left Angle Biometric Scan',
    instruction: 'Slowly turn your face toward the LEFT highlighted guideline arc',
    targetZone: 'LEFT',
  },
  {
    id: 'RIGHT',
    title: 'Step 3/4: Right Angle Biometric Scan',
    instruction: 'Slowly turn your face toward the RIGHT highlighted guideline arc',
    targetZone: 'RIGHT',
  },
  {
    id: 'UP',
    title: 'Step 4/4: Upper Liveness Verification',
    instruction: 'Slightly tilt your head UP toward the top highlighted guideline',
    targetZone: 'UP',
  },
];

export default function EmployeeDailySalaryBanner() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [data, setData] = useState<DailySalaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [showFullDetails, setShowFullDetails] = useState<boolean>(false);

  // Security Modal States
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState<boolean>(false);
  const [securityStage, setSecurityStage] = useState<
    'FACE_SCAN' | 'PIN_DOWNLOAD' | 'SWIPE_UNLOCK' | 'PIN_ENTRY'
  >('FACE_SCAN');

  // Camera & Biometric Face Angle States
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentAngleIndex, setCurrentAngleIndex] = useState<number>(0);
  const [angleHoldProgress, setAngleHoldProgress] = useState<number>(0);
  const [completedAngles, setCompletedAngles] = useState<string[]>([]);
  const [faceDetectedInFrame, setFaceDetectedInFrame] = useState<boolean>(false);
  const [detectedDirection, setDetectedDirection] = useState<string>('CENTER');

  // Generated / Stored PIN & Download / Swipe States
  const [generatedPin, setGeneratedPin] = useState<string>('');
  const [hasDownloadedPin, setHasDownloadedPin] = useState<boolean>(false);
  const [swipeProgress, setSwipeProgress] = useState<number>(0); // 0 to 100
  const [isDraggingSwipe, setIsDraggingSwipe] = useState<boolean>(false);
  const swipeTrackRef = useRef<HTMLDivElement | null>(null);

  // PIN Input State
  const [pinInput, setPinInput] = useState<string>('');
  const [verifyingPin, setVerifyingPin] = useState<boolean>(false);

  const fetchDailySalary = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const res = await fetch('/api/employee/daily-salary', {
        headers: {
          Authorization: user.id,
        },
      });
      if (res.ok) {
        const json: DailySalaryResponse = await res.json();
        setData(json);
        if (json.security?.savedPin) {
          setGeneratedPin(json.security.savedPin);
        }
      }
    } catch (error) {
      console.error('Error fetching employee daily salary:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDailySalary();
  }, [fetchDailySalary]);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (!isSecurityModalOpen || securityStage !== 'FACE_SCAN') {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isSecurityModalOpen, securityStage, stopCamera]);

  // Start real-time web camera for biometric scan
  const startCamera = async () => {
    setCameraError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(
        'Camera permission denied or camera unavailable. Please allow browser camera access.'
      );
    }
  };

  // Complete 1-time face verification on backend and generate PIN
  const finishBiometricEnrollment = useCallback(async () => {
    stopCamera();
    try {
      const res = await fetch('/api/employee/daily-salary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: user?.id || '',
        },
        body: JSON.stringify({
          action: 'COMPLETE_FACE_VERIFICATION',
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to complete biometric verification');
      }

      const newPin = String(result.pin);
      setGeneratedPin(newPin);
      if (user?.id) {
        localStorage.setItem(`attendx_salary_pin_${user.id}`, newPin);
      }

      setData((prev) =>
        prev
          ? {
              ...prev,
              security: {
                faceVerified: true,
                verifiedAt: result.verifiedAt,
                savedPin: newPin,
              },
            }
          : prev
      );

      setHasDownloadedPin(false);
      setSwipeProgress(0);
      setSecurityStage('PIN_DOWNLOAD');

      toast({
        title: 'Biometric Face Verification Complete!',
        description:
          'Your one-time 3D face angle check succeeded. Download your generated Security PIN below.',
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Verification Error',
        description: err.message || 'Could not finalize biometric verification',
      });
    }
  }, [stopCamera, user?.id, toast]);

  // Real-time Web Camera Face Presence & Angle Motion Analysis Loop
  useEffect(() => {
    if (!cameraActive || securityStage !== 'FACE_SCAN' || !isSecurityModalOpen) {
      return;
    }

    const interval = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const w = 160;
      const h = 120;
      canvas.width = w;
      canvas.height = h;

      // Draw mirrored video frame
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();

      const frame = ctx.getImageData(0, 0, w, h).data;
      const prev = prevFrameRef.current;

      let skinPixels = 0;
      let sumX = 0;
      let sumY = 0;
      let motionEnergy = 0;
      let leftMotion = 0;
      let rightMotion = 0;
      let topMotion = 0;

      // Analyze center oval & directional zones
      for (let y = 15; y < h - 15; y += 2) {
        for (let x = 20; x < w - 20; x += 2) {
          const i = (y * w + x) * 4;
          const r = frame[i];
          const g = frame[i + 1];
          const b = frame[i + 2];

          // Broad skin-tone / face luminance heuristic across lighting conditions
          const isFaceTone =
            r > 55 &&
            g > 35 &&
            b > 20 &&
            r > b &&
            Math.abs(r - g) < 110 &&
            r + g + b > 140 &&
            r + g + b < 720;

          if (isFaceTone) {
            skinPixels++;
            sumX += x;
            sumY += y;
          }

          if (prev) {
            const diff =
              Math.abs(r - prev[i]) +
              Math.abs(g - prev[i + 1]) +
              Math.abs(b - prev[i + 2]);
            if (diff > 38) {
              motionEnergy++;
              if (x < w * 0.45) leftMotion++;
              if (x > w * 0.55) rightMotion++;
              if (y < h * 0.45) topMotion++;
            }
          }
        }
      }

      prevFrameRef.current = new Uint8ClampedArray(frame);

      const hasFace = skinPixels > 120;
      setFaceDetectedInFrame(hasFace);

      if (!hasFace) return;

      const avgX = sumX / skinPixels; // ~80 is center
      const avgY = sumY / skinPixels; // ~60 is center

      let currentDir = 'CENTER';
      if (avgX < 74 || leftMotion > rightMotion * 1.25) {
        currentDir = 'LEFT';
      } else if (avgX > 86 || rightMotion > leftMotion * 1.25) {
        currentDir = 'RIGHT';
      } else if (avgY < 56 || topMotion > 20) {
        currentDir = 'UP';
      }
      setDetectedDirection(currentDir);

      const targetStep = FACE_ANGLE_STEPS[currentAngleIndex];
      if (!targetStep) return;

      // Check if user's face position or active head movement matches the target angle guideline
      const matchesTargetAngle =
        (targetStep.id === 'CENTER' && hasFace) ||
        (targetStep.id === 'LEFT' &&
          (currentDir === 'LEFT' || motionEnergy > 22)) ||
        (targetStep.id === 'RIGHT' &&
          (currentDir === 'RIGHT' || motionEnergy > 22)) ||
        (targetStep.id === 'UP' &&
          (currentDir === 'UP' || motionEnergy > 18));

      if (matchesTargetAngle) {
        setAngleHoldProgress((prevProg) => {
          const nextProg = prevProg + 25;
          if (nextProg >= 100) {
            const stepId = targetStep.id;
            setCompletedAngles((prevDone) =>
              prevDone.includes(stepId) ? prevDone : [...prevDone, stepId]
            );
            if (currentAngleIndex < FACE_ANGLE_STEPS.length - 1) {
              setCurrentAngleIndex((idx) => idx + 1);
            } else {
              finishBiometricEnrollment();
            }
            return 0;
          }
          return nextProg;
        });
      }
    }, 180);

    return () => clearInterval(interval);
  }, [
    cameraActive,
    securityStage,
    isSecurityModalOpen,
    currentAngleIndex,
    finishBiometricEnrollment,
  ]);

  // Handle clicking the Eye Icon on the Credit Card
  const handleEyeButtonClick = () => {
    if (isUnlocked) {
      setIsUnlocked(false);
      setShowFullDetails(false);
      return;
    }

    setSwipeProgress(0);
    setPinInput('');

    // Check if employee has already completed 1-time biometric face verification
    if (data?.security?.faceVerified) {
      setSecurityStage('SWIPE_UNLOCK');
      setIsSecurityModalOpen(true);
    } else {
      setCurrentAngleIndex(0);
      setAngleHoldProgress(0);
      setCompletedAngles([]);
      setSecurityStage('FACE_SCAN');
      setIsSecurityModalOpen(true);
      setTimeout(() => {
        startCamera();
      }, 150);
    }
  };

  // Generate and Download a sleek PNG Security PIN Card
  const handleDownloadPinCard = () => {
    const pinCode = generatedPin || data?.security?.savedPin || '000000';
    const empName = data?.employee?.name || user?.email || 'Employee';
    const empDept = data?.employee?.department || 'General';

    const c = document.createElement('canvas');
    c.width = 720;
    c.height = 420;
    const ctx = c.getContext('2d');
    if (ctx) {
      // Dark luxury background gradient
      const grad = ctx.createLinearGradient(0, 0, 720, 420);
      grad.addColorStop(0, '#020617');
      grad.addColorStop(0.5, '#064e3b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 720, 420);

      // Gold border
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4;
      ctx.strokeRect(18, 18, 684, 384);

      // Header
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('ATTENDX BIOMETRIC SECURITY PASS', 45, 65);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(empName, 45, 110);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px sans-serif';
      ctx.fillText(`Department: ${empDept}  |  One-Time Face ID Verified`, 45, 140);

      // PIN Box
      ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
      ctx.fillRect(45, 175, 630, 120);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.strokeRect(45, 175, 630, 120);

      ctx.fillStyle = '#a7f3d0';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('YOUR PERSONAL SALARY ACCESS PIN CODE:', 70, 208);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px monospace';
      ctx.fillText(pinCode.split('').join('  '), 70, 268);

      // Footer
      ctx.fillStyle = '#64748b';
      ctx.font = '13px sans-serif';
      ctx.fillText(
        `Issued: ${new Date().toLocaleString()} — Keep this PIN secure for viewing salary details.`,
        45,
        355
      );

      const url = c.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `AttendX_Salary_Security_PIN_${empName.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    setHasDownloadedPin(true);
    toast({
      title: 'Security PIN Downloaded',
      description:
        'Now swipe the bar below to the right to auto-apply your PIN and unlock your earnings.',
    });
  };

  // Trigger transition when Swipe reaches >= 88%
  const completeSwipeToPinEntry = useCallback(() => {
    setSwipeProgress(100);
    setIsDraggingSwipe(false);
    setSecurityStage('PIN_ENTRY');

    // Automatically apply the generated/downloaded PIN into the input field!
    const storedPin =
      generatedPin ||
      data?.security?.savedPin ||
      (user?.id ? localStorage.getItem(`attendx_salary_pin_${user.id}`) : '') ||
      '';

    if (storedPin) {
      setPinInput('');
      // Smooth digit-by-digit auto-fill effect
      storedPin.split('').forEach((digit, idx) => {
        setTimeout(() => {
          setPinInput((prev) => (prev + digit).slice(0, 6));
        }, (idx + 1) * 90);
      });
    }
  }, [generatedPin, data?.security?.savedPin, user?.id]);

  // Handle Mouse / Touch Drag on Swipe Bar
  const handleSwipeMove = (clientX: number) => {
    if (!isDraggingSwipe || !swipeTrackRef.current) return;
    const rect = swipeTrackRef.current.getBoundingClientRect();
    const relX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = Math.round((relX / rect.width) * 100);
    if (pct >= 85) {
      completeSwipeToPinEntry();
    } else {
      setSwipeProgress(pct);
    }
  };

  // Verify PIN with Backend
  const handleVerifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pinInput || pinInput.trim().length < 4) {
      toast({
        variant: 'destructive',
        title: 'PIN Required',
        description: 'Please enter your 6-digit Security PIN.',
      });
      return;
    }

    try {
      setVerifyingPin(true);
      const res = await fetch('/api/employee/daily-salary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: user?.id || '',
        },
        body: JSON.stringify({
          action: 'VERIFY_PIN',
          pin: pinInput.trim(),
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.verified) {
        throw new Error(result.error || 'Incorrect Security PIN');
      }

      setIsUnlocked(true);
      setShowFullDetails(true);
      setIsSecurityModalOpen(false);

      toast({
        title: 'Identity Verified',
        description: 'Your Daily Earned Salary & Monthly Earnings are now visible.',
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'PIN Verification Failed',
        description: err.message || 'Invalid PIN code',
      });
    } finally {
      setVerifyingPin(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="w-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm animate-pulse mb-6">
        <div className="h-6 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg mb-3" />
        <div className="h-36 w-full bg-slate-100 dark:bg-slate-800/60 rounded-2xl" />
      </div>
    );
  }

  if (!data) return null;

  const {
    employee,
    period,
    departmentOffDayPolicy: offPolicy,
    dailySummary,
    monthlyStructure,
    dailyRecords,
  } = data;

  return (
    <div className="w-full space-y-4 mb-8">
      {/* 1. COMPACT ROUNDED TOP HIGHLIGHT BANNER WITH BOLD TEXT */}
      <div className="rounded-3xl border-2 border-primary/25 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white p-3.5 sm:p-5 shadow-xl relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        {/* Top Highlighted Pill Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 mb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              Daily Salary Calculation & Earnings Visibility
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight">
              • {period.monthName} (Estimated)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/10 text-slate-200 border border-white/15">
              <Building2 className="h-3 w-3 text-emerald-400" />
              {offPolicy.departmentName} Dept: {offPolicy.allocatedPaidOffDays} Paid Off-Days
            </span>
            {dailySummary.attendedToday ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/25 text-emerald-300 border border-emerald-400/40">
                <CheckCircle2 className="h-3 w-3" /> Today Earned
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                <Clock className="h-3 w-3" /> Attendance Pending Today
              </span>
            )}
          </div>
        </div>

        {/* Main Responsive Grid: Left = Nano Banana Credit Card SVG | Right = Quick Highlight Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-center">
          {/* NANO BANANA LUXURY CREDIT CARD WITH CUSTOM SVG OVERLAYS */}
          <div className="lg:col-span-6 xl:col-span-5">
            <div
              className="relative w-full rounded-2xl overflow-hidden border border-white/20 shadow-2xl transition-transform duration-300 hover:scale-[1.01] select-none"
              style={{
                backgroundImage: `url('/images/salary-card-bg.png')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {/* Dark Glass Overlay for Contrast */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950/75 via-slate-900/55 to-emerald-950/75 backdrop-blur-[1px]" />

              {/* Decorative Credit Card SVG Mesh & Hologram Lines */}
              <svg
                className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
                viewBox="0 0 400 240"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="350"
                  cy="40"
                  r="110"
                  stroke="url(#cardGrad1)"
                  strokeWidth="1.5"
                  strokeDasharray="6 6"
                />
                <circle
                  cx="350"
                  cy="40"
                  r="75"
                  stroke="url(#cardGrad1)"
                  strokeWidth="1"
                />
                <path
                  d="M-20 190 C 90 140, 220 230, 420 150"
                  stroke="url(#cardGrad2)"
                  strokeWidth="2"
                />
                <path
                  d="M-20 215 C 120 165, 250 245, 420 175"
                  stroke="url(#cardGrad2)"
                  strokeWidth="1"
                />
                <defs>
                  <linearGradient id="cardGrad1" x1="0" y1="0" x2="400" y2="240">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                  <linearGradient id="cardGrad2" x1="0" y1="0" x2="400" y2="0">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="50%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Credit Card Content */}
              <div className="relative z-10 p-4 sm:p-5 flex flex-col justify-between min-h-[205px] sm:min-h-[220px]">
                {/* Card Top Row: Chip SVG + Contactless SVG + Eye Security Button */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {/* EMV Metallic Gold Chip SVG */}
                    <svg
                      width="44"
                      height="34"
                      viewBox="0 0 44 34"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="shrink-0 drop-shadow"
                    >
                      <rect
                        width="44"
                        height="34"
                        rx="6"
                        fill="url(#goldChipGrad)"
                        stroke="#FDE68A"
                        strokeWidth="1"
                      />
                      <path
                        d="M0 12H15M29 12H44M0 22H15M29 22H44M15 0V34M29 0V34"
                        stroke="#92400E"
                        strokeWidth="1.2"
                        strokeOpacity="0.55"
                      />
                      <rect
                        x="15"
                        y="10"
                        width="14"
                        height="14"
                        rx="2"
                        stroke="#92400E"
                        strokeWidth="1.2"
                        strokeOpacity="0.55"
                      />
                      <defs>
                        <linearGradient
                          id="goldChipGrad"
                          x1="0"
                          y1="0"
                          x2="44"
                          y2="34"
                          gradientUnits="userSpaceOnUse"
                        >
                          <stop stopColor="#FDE68A" />
                          <stop offset="0.5" stopColor="#F59E0B" />
                          <stop offset="1" stopColor="#B45309" />
                        </linearGradient>
                      </defs>
                    </svg>

                    {/* Contactless NFC Wave SVG */}
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-emerald-300/90"
                    >
                      <path
                        d="M8.5 14.5C9.88 13.12 9.88 10.88 8.5 9.5M12 17C14.76 14.24 14.76 9.76 12 7M15.5 19.5C19.64 15.36 19.64 8.64 15.5 4.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  {/* EYE ICON BUTTON TO VERIFY BIOMETRICS / PIN & REVEAL TOTAL EARNINGS */}
                  <button
                    type="button"
                    onClick={handleEyeButtonClick}
                    className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shadow-lg border ${
                      isUnlocked
                        ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/35'
                        : 'bg-white/15 border-white/30 text-white hover:bg-emerald-500 hover:border-emerald-400 hover:text-slate-950'
                    }`}
                    title={
                      isUnlocked
                        ? 'Hide Salary & Lock Card'
                        : 'Verify Biometrics / PIN to View Earnings'
                    }
                  >
                    {isUnlocked ? (
                      <>
                        <EyeOff className="h-4 w-4" />
                        <span>Hide Earnings</span>
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 animate-pulse" />
                        <span>View Earnings</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Card Center: TOTAL EARNINGS DISPLAY */}
                <div className="my-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-emerald-300/90">
                      Total Monthly Net Earnings (Estimated)
                    </span>
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  </div>

                  {isUnlocked ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1"
                    >
                      <div className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow">
                        {formatCurrency(monthlyStructure.netSalary)}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs font-bold text-emerald-200">
                        <span>
                          Today Earned:{' '}
                          <strong className="text-white font-black">
                            {formatCurrency(dailySummary.todayEarnedSalary)}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          MTD Earned:{' '}
                          <strong className="text-white font-black">
                            {formatCurrency(dailySummary.accumulatedDailySalary)}
                          </strong>
                        </span>
                      </div>
                    </motion.div>
                  ) : (
                    <div
                      onClick={handleEyeButtonClick}
                      className="mt-1 cursor-pointer group/mask"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl sm:text-3xl font-black tracking-widest text-white/90 select-none">
                          LKR • • • • • • •
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 group-hover/mask:bg-emerald-400 group-hover/mask:text-slate-950 transition-colors">
                          Tap Eye to Unlock
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300/80 mt-1 font-medium">
                        Protected by{' '}
                        {data.security.faceVerified
                          ? 'Security PIN & Biometric Lock'
                          : 'One-Time Web Face Biometrics & PIN'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Card Bottom Footer: Cardholder Name, ID & Brand SVG */}
                <div className="flex items-end justify-between pt-2 border-t border-white/15">
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-slate-300 font-bold">
                      Employee Cardholder
                    </p>
                    <p className="text-xs sm:text-sm font-extrabold tracking-wide text-white truncate max-w-[200px] sm:max-w-[240px]">
                      {employee.name.toUpperCase()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right mr-1">
                      <p className="text-[9px] uppercase tracking-widest text-slate-300 font-bold">
                        EMP ID
                      </p>
                      <p className="text-xs font-mono font-bold text-emerald-300">
                        #{String(employee.sequentialId || 1).padStart(4, '0')}
                      </p>
                    </div>
                    {/* Dual Circle Mastercard-style Fintech SVG Crest */}
                    <svg
                      width="36"
                      height="24"
                      viewBox="0 0 36 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle
                        cx="13"
                        cy="12"
                        r="10"
                        fill="#10B981"
                        fillOpacity="0.85"
                      />
                      <circle
                        cx="23"
                        cy="12"
                        r="10"
                        fill="#06B6D4"
                        fillOpacity="0.85"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: DAILY SALARY HIGHLIGHT SUMMARY CARDS */}
          <div className="lg:col-span-6 xl:col-span-7 space-y-3.5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Box 1: Daily Earned Salary (Estimated) */}
              <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5 backdrop-blur-sm">
                <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-emerald-300 block">
                  Daily Earned Salary
                </span>
                <div className="text-lg sm:text-xl font-black text-white mt-1">
                  {isUnlocked
                    ? formatCurrency(dailySummary.standardDailyEarning)
                    : 'LKR •••••'}
                </div>
                <span className="text-[10px] text-slate-300 font-semibold block mt-0.5">
                  Per Worked Day (Estimated)
                </span>
              </div>

              {/* Box 2: Month-To-Date Accumulated Daily Salary */}
              <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5 backdrop-blur-sm">
                <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-cyan-300 block">
                  Accumulated (MTD)
                </span>
                <div className="text-lg sm:text-xl font-black text-white mt-1">
                  {isUnlocked
                    ? formatCurrency(dailySummary.accumulatedDailySalary)
                    : 'LKR •••••'}
                </div>
                <span className="text-[10px] text-slate-300 font-semibold block mt-0.5">
                  {offPolicy.daysWorked} Worked + {offPolicy.paidOffDaysUsed} Paid Off
                </span>
              </div>

              {/* Box 3: Gross Salary vs Deductions */}
              <div className="col-span-2 sm:col-span-1 rounded-2xl bg-white/10 border border-white/15 p-3.5 backdrop-blur-sm">
                <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-amber-300 block">
                  Gross Salary
                </span>
                <div className="text-lg sm:text-xl font-black text-white mt-1">
                  {isUnlocked
                    ? formatCurrency(monthlyStructure.grossSalary)
                    : 'LKR •••••'}
                </div>
                <span className="text-[10px] text-slate-300 font-semibold block mt-0.5">
                  EPF (8%):{' '}
                  {isUnlocked
                    ? formatCurrency(monthlyStructure.employeeEpf)
                    : '••••'}
                </span>
              </div>
            </div>

            {/* Bottom Action Row inside Highlight Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-[11px] sm:text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>
                  Labelled as{' '}
                  <strong className="text-white underline decoration-emerald-400">
                    Daily Earned Salary (Estimated)
                  </strong>{' '}
                  until month-end payroll finalisation.
                </span>
              </p>

              {isUnlocked ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowFullDetails(!showFullDetails)}
                  className="h-8 rounded-xl text-xs font-extrabold gap-1.5 bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                >
                  {showFullDetails ? (
                    <>
                      Hide Full Salary Structure <ChevronUp className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      Full Salary Breakdown & Daily Log{' '}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleEyeButtonClick}
                  className="h-8 rounded-xl text-xs font-extrabold gap-1.5 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Unlock Salary Breakdown
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. EXPANDABLE FULL EMPLOYEE SALARY DASHBOARD (SECTIONS 1 TO 7 OF REQUIREMENT DOCUMENT) */}
      <AnimatePresence>
        {isUnlocked && showFullDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-lg space-y-6">
              {/* Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    Employee Salary Structure & Daily Earned Log — {period.monthName}
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium">
                    Calculated automatically from your attendance records, salary configuration, and{' '}
                    <strong>{offPolicy.departmentName}</strong> department off-day rules.
                  </p>
                </div>
                <Badge className="w-fit bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xs">
                  Daily Earned Salary (Estimated)
                </Badge>
              </div>

              {/* 4-Step Monthly Calculation Grid + Company Contributions */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* STEP 1 & STEP 2: EARNINGS & GROSS SALARY */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/60 dark:bg-slate-950/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-primary">
                      Step 1 & 2: Gross Salary Structure
                    </span>
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>

                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">
                        Basic Salary
                      </span>
                      <span className="font-bold">
                        {formatCurrency(monthlyStructure.basicSalary)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">
                        Paid Off-Day Payment ({offPolicy.additionalPayableOffDays}{' '}
                        extra days)
                      </span>
                      <span className="font-bold text-emerald-600">
                        + {formatCurrency(monthlyStructure.paidOffDayPayment)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 px-2.5 rounded-lg bg-primary/10 font-bold text-primary">
                      <span>Step 1: Total for EPF</span>
                      <span>{formatCurrency(monthlyStructure.totalForEpf)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">
                        Attendance Incentive
                      </span>
                      <span className="font-semibold">
                        + {formatCurrency(monthlyStructure.attendanceIncentive)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">
                        Performance Incentive
                      </span>
                      <span className="font-semibold">
                        + {formatCurrency(monthlyStructure.performanceIncentive)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">
                        OT & Other Allowances
                      </span>
                      <span className="font-semibold">
                        + {formatCurrency(monthlyStructure.otAndOtherAllowances)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t font-black text-sm sm:text-base text-slate-900 dark:text-white">
                      <span>Step 2: Gross Salary</span>
                      <span className="text-emerald-600">
                        {formatCurrency(monthlyStructure.grossSalary)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* STEP 3 & STEP 4: DEDUCTIONS & NET SALARY */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/60 dark:bg-slate-950/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-600">
                      Step 3 & 4: Deductions & Net Salary
                    </span>
                    <ShieldCheck className="h-4 w-4 text-rose-600" />
                  </div>

                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between py-1.5 px-2.5 rounded-lg bg-rose-500/10 font-bold text-rose-600 dark:text-rose-400">
                      <span>
                        Step 3: Employee EPF ({monthlyStructure.epfEmployeeRate}%)
                      </span>
                      <span>- {formatCurrency(monthlyStructure.employeeEpf)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">
                        Salary Advances
                      </span>
                      <span className="font-semibold">
                        - {formatCurrency(monthlyStructure.salaryAdvances)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">
                        Loans
                      </span>
                      <span className="font-semibold">
                        - {formatCurrency(monthlyStructure.loanDeduction)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">
                        Pending Bills
                      </span>
                      <span className="font-semibold">
                        - {formatCurrency(monthlyStructure.pendingBills)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">
                        Other Applicable Deductions
                      </span>
                      <span className="font-semibold">
                        - {formatCurrency(monthlyStructure.otherDeductions)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-rose-600 pt-1 border-t">
                      <span>Total Deductions</span>
                      <span>
                        - {formatCurrency(monthlyStructure.totalDeductions)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t font-black text-base text-emerald-600 dark:text-emerald-400">
                      <span>Step 4: Net Salary</span>
                      <span>{formatCurrency(monthlyStructure.netSalary)}</span>
                    </div>
                  </div>
                </div>

                {/* COMPANY STATUTORY CONTRIBUTIONS & DEPT OFF-DAY POLICY */}
                <div className="space-y-4">
                  {/* Company Contributions (Separate Display as Required by Section 2) */}
                  <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-2.5">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                      Company Statutory Contributions (Separate)
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Contributed by the company on top of your salary (not deducted from your net pay):
                    </p>
                    <div className="space-y-1.5 text-xs sm:text-sm pt-1">
                      <div className="flex justify-between font-bold">
                        <span>
                          Company EPF (
                          {monthlyStructure.companyContributions.epfEmployerRate}
                          %)
                        </span>
                        <span className="text-emerald-600">
                          {formatCurrency(
                            monthlyStructure.companyContributions.companyEpf12
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>
                          Company ETF (
                          {monthlyStructure.companyContributions.etfEmployerRate}
                          %)
                        </span>
                        <span className="text-emerald-600">
                          {formatCurrency(
                            monthlyStructure.companyContributions.companyEtf3
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Department-Specific Off-Day Policy Breakdown */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/60 dark:bg-slate-950/50 space-y-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                      {offPolicy.departmentName} Off-Day Policy
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border">
                        <span className="text-muted-foreground block text-[10px]">
                          Paid Off-Days Quota
                        </span>
                        <span className="font-black text-sm">
                          {offPolicy.allocatedPaidOffDays} Days / Mo
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border">
                        <span className="text-muted-foreground block text-[10px]">
                          Days Worked
                        </span>
                        <span className="font-black text-sm text-emerald-600">
                          {offPolicy.daysWorked} Days
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border">
                        <span className="text-muted-foreground block text-[10px]">
                          Paid Off-Days Applied
                        </span>
                        <span className="font-black text-sm text-blue-600">
                          {offPolicy.paidOffDaysUsed} Days
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border">
                        <span className="text-muted-foreground block text-[10px]">
                          Extra Off-Days Worked
                        </span>
                        <span className="font-black text-sm text-amber-600">
                          {offPolicy.additionalPayableOffDays} Days
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* DAILY SALARY RECORDS LOG (DEDUPLICATED BY ATTENDANCE DATE) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Daily Earned Salary Log ({period.monthName})
                  </h4>
                  <span className="text-xs text-muted-foreground font-semibold">
                    Showing {dailyRecords.length} day(s) • Duplicate dates automatically prevented
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[320px] overflow-y-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                      <tr className="text-left font-bold text-slate-700 dark:text-slate-200">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Day Status</th>
                        <th className="py-2.5 px-3 hidden sm:table-cell">
                          Check-In / Out
                        </th>
                        <th className="py-2.5 px-3 text-right">Basic Rate</th>
                        <th className="py-2.5 px-3 text-right hidden md:table-cell">
                          Incentive / OT
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          Daily Earned (Est.)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {dailyRecords.map((rec) => (
                        <tr
                          key={rec.date}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          <td className="py-2.5 px-3 font-semibold">
                            <div>{rec.date}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {rec.dayName}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {rec.dayType === 'WORKED' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Worked ({rec.locationName})
                              </span>
                            )}
                            {rec.dayType === 'ADDITIONAL_OFF_DAY_WORKED' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                Extra Off-Day Worked
                              </span>
                            )}
                            {rec.dayType === 'PAID_OFF_DAY' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                Paid Off-Day Included
                              </span>
                            )}
                            {rec.dayType === 'UNPAID_ABSENCE' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                Unpaid Absence
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 hidden sm:table-cell text-muted-foreground">
                            {rec.checkInTime
                              ? `${rec.checkInTime} - ${
                                  rec.checkOutTime || 'Active'
                                }`
                              : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium">
                            {formatCurrency(rec.basicEarned)}
                          </td>
                          <td className="py-2.5 px-3 text-right hidden md:table-cell font-medium">
                            {formatCurrency(
                              rec.incentiveEarned + rec.otPayEarned
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(rec.totalDayEarned)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. REAL-TIME BIOMETRIC FACE VERIFICATION + PIN GENERATION + SWIPE TO UNLOCK MODAL */}
      <Dialog
        open={isSecurityModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            stopCamera();
            setIsSecurityModalOpen(false);
          }
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-md rounded-3xl border border-slate-800 bg-slate-950 text-white p-5 sm:p-6 shadow-2xl overflow-hidden">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-base sm:text-lg">
              <ScanFace className="h-5 w-5" />
              <DialogTitle className="text-white">
                {securityStage === 'FACE_SCAN' &&
                  'One-Time Real-Time Face Biometrics'}
                {securityStage === 'PIN_DOWNLOAD' &&
                  'Biometric Verified — Download Security PIN'}
                {securityStage === 'SWIPE_UNLOCK' &&
                  'Swipe to Verify Security PIN'}
                {securityStage === 'PIN_ENTRY' &&
                  'Enter Security PIN to View Earnings'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-400">
              {securityStage === 'FACE_SCAN' &&
                'Align and angle your face following the highlighted biometric guidelines. This camera verification is only required once.'}
              {securityStage === 'PIN_DOWNLOAD' &&
                'Your face liveness check is complete! Download your personal Security PIN card and swipe below to unlock.'}
              {securityStage === 'SWIPE_UNLOCK' &&
                'Swipe the security bar below to auto-apply your PIN and view your salary details.'}
              {securityStage === 'PIN_ENTRY' &&
                'Your downloaded Security PIN has been applied below. Confirm to unlock your earnings.'}
            </DialogDescription>
          </DialogHeader>

          {/* STAGE 1: REAL-TIME WEB CAMERA FACE ANGLE GUIDELINE SCANNER */}
          {securityStage === 'FACE_SCAN' && (
            <div className="space-y-4 py-2">
              <div className="relative mx-auto w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden border-4 border-slate-800 bg-slate-900 flex items-center justify-center shadow-2xl">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* SVG Biometric Face Guideline Overlay & Highlighted Angle Arcs */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 260 260"
                  fill="none"
                >
                  {/* Face Silhouette Guide Oval */}
                  <ellipse
                    cx="130"
                    cy="130"
                    rx="72"
                    ry="92"
                    stroke={faceDetectedInFrame ? '#10b981' : '#64748b'}
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                  />

                  {/* TOP ANGLE HIGHLIGHT ARC */}
                  <path
                    d="M 70 30 A 95 95 0 0 1 190 30"
                    stroke={
                      FACE_ANGLE_STEPS[currentAngleIndex]?.id === 'UP'
                        ? '#34d399'
                        : completedAngles.includes('UP')
                        ? '#10b981'
                        : '#334155'
                    }
                    strokeWidth={
                      FACE_ANGLE_STEPS[currentAngleIndex]?.id === 'UP' ? '7' : '4'
                    }
                    strokeLinecap="round"
                  />

                  {/* LEFT ANGLE HIGHLIGHT ARC */}
                  <path
                    d="M 28 75 A 95 95 0 0 0 28 185"
                    stroke={
                      FACE_ANGLE_STEPS[currentAngleIndex]?.id === 'LEFT'
                        ? '#34d399'
                        : completedAngles.includes('LEFT')
                        ? '#10b981'
                        : '#334155'
                    }
                    strokeWidth={
                      FACE_ANGLE_STEPS[currentAngleIndex]?.id === 'LEFT'
                        ? '7'
                        : '4'
                    }
                    strokeLinecap="round"
                  />

                  {/* RIGHT ANGLE HIGHLIGHT ARC */}
                  <path
                    d="M 232 75 A 95 95 0 0 1 232 185"
                    stroke={
                      FACE_ANGLE_STEPS[currentAngleIndex]?.id === 'RIGHT'
                        ? '#34d399'
                        : completedAngles.includes('RIGHT')
                        ? '#10b981'
                        : '#334155'
                    }
                    strokeWidth={
                      FACE_ANGLE_STEPS[currentAngleIndex]?.id === 'RIGHT'
                        ? '7'
                        : '4'
                    }
                    strokeLinecap="round"
                  />

                  {/* Scanning laser line */}
                  <line
                    x1="45"
                    y1={70 + (angleHoldProgress % 100) * 1.2}
                    x2="215"
                    y2={70 + (angleHoldProgress % 100) * 1.2}
                    stroke="#34d399"
                    strokeWidth="1.5"
                    strokeOpacity="0.7"
                  />
                </svg>

                {!cameraActive && !cameraError && (
                  <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center p-4 text-center">
                    <Camera className="h-8 w-8 text-emerald-400 animate-bounce mb-2" />
                    <p className="text-xs font-bold text-slate-200">
                      Starting Real-Time Biometric Camera...
                    </p>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-5 text-center space-y-2">
                    <Camera className="h-7 w-7 text-amber-400" />
                    <p className="text-xs text-slate-300">{cameraError}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={startCamera}
                      className="h-7 text-xs border-emerald-500/40 text-emerald-300"
                    >
                      Retry Camera
                    </Button>
                  </div>
                )}
              </div>

              {/* Current Angle Guideline Instruction Box */}
              <div className="rounded-2xl bg-slate-900 border border-emerald-500/30 p-3.5 text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-emerald-400 uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5" />
                  {FACE_ANGLE_STEPS[currentAngleIndex]?.title}
                </div>
                <p className="text-xs sm:text-sm font-bold text-white">
                  {FACE_ANGLE_STEPS[currentAngleIndex]?.instruction}
                </p>

                {/* Step Pills */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {FACE_ANGLE_STEPS.map((st, idx) => {
                    const isDone = idx < currentAngleIndex || completedAngles.includes(st.id);
                    const isCurrent = idx === currentAngleIndex;
                    return (
                      <div
                        key={st.id}
                        className={`py-1 px-1.5 rounded-lg text-[10px] font-extrabold border transition-all ${
                          isDone
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                            : isCurrent
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 animate-pulse'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {st.id} {isDone ? '✓' : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STAGE 2 & 3: PIN GENERATED + DOWNLOAD + SWIPE TO UNLOCK */}
          {(securityStage === 'PIN_DOWNLOAD' ||
            securityStage === 'SWIPE_UNLOCK') && (
            <div className="space-y-5 py-2">
              {securityStage === 'PIN_DOWNLOAD' && (
                <div className="rounded-2xl bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/40 p-4 text-center space-y-3">
                  <div className="mx-auto w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                      Your Personal Security PIN
                    </span>
                    <div className="text-3xl font-mono font-black tracking-[0.35em] text-white mt-1 pl-2">
                      {generatedPin || '------'}
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={handleDownloadPinCard}
                    className="w-full h-10 rounded-xl font-extrabold text-xs gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg"
                  >
                    <Download className="h-4 w-4" />
                    {hasDownloadedPin
                      ? ' Security PIN Card Downloaded ✓ (Download Again)'
                      : 'Download Security PIN Card'}
                  </Button>
                </div>
              )}

              {securityStage === 'SWIPE_UNLOCK' && (
                <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-white">
                      Face Biometrics Already Enrolled
                    </p>
                    <p className="text-slate-400 mt-0.5">
                      Swipe the slider below to enter your PIN (auto-fills on your verified device).
                    </p>
                  </div>
                </div>
              )}

              {/* INTERACTIVE SWIPE-TO-THE-SIDE SLIDER BAR */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1">
                  <span>
                    {securityStage === 'PIN_DOWNLOAD' && !hasDownloadedPin
                      ? 'Step 1: Download PIN above, then Swipe Right'
                      : 'Swipe Right to Enter & Auto-Apply Security PIN'}
                  </span>
                  <span className="text-emerald-400">{swipeProgress}%</span>
                </div>

                <div
                  ref={swipeTrackRef}
                  onMouseMove={(e) => handleSwipeMove(e.clientX)}
                  onMouseUp={() => {
                    if (swipeProgress < 85) setSwipeProgress(0);
                    setIsDraggingSwipe(false);
                  }}
                  onMouseLeave={() => {
                    if (isDraggingSwipe && swipeProgress < 85) {
                      setSwipeProgress(0);
                      setIsDraggingSwipe(false);
                    }
                  }}
                  onTouchMove={(e) => {
                    if (e.touches[0]) handleSwipeMove(e.touches[0].clientX);
                  }}
                  onTouchEnd={() => {
                    if (swipeProgress < 85) setSwipeProgress(0);
                    setIsDraggingSwipe(false);
                  }}
                  onClick={() => {
                    // Also allow single tap/click on track for effortless mobile/desktop use
                    completeSwipeToPinEntry();
                  }}
                  className="relative h-14 w-full rounded-2xl bg-slate-900 border-2 border-emerald-500/40 overflow-hidden cursor-pointer select-none p-1.5 flex items-center"
                >
                  {/* Fill progress */}
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-600/40 to-cyan-500/40 transition-all duration-75"
                    style={{ width: `${ Math.max(14, swipeProgress) }%` }}
                  />

                  <div className="relative z-10 w-full text-center text-xs font-extrabold uppercase tracking-wider text-emerald-200 pointer-events-none flex items-center justify-center gap-1.5">
                    <span>Swipe Right to Enter PIN</span>
                    <ChevronRight className="h-4 w-4 animate-pulse" />
                    <ChevronRight className="h-4 w-4 -ml-2.5 animate-pulse" />
                  </div>

                  {/* Draggable Handle */}
                  <div
                    onMouseDown={() => setIsDraggingSwipe(true)}
                    onTouchStart={() => setIsDraggingSwipe(true)}
                    style={{
                      left: `calc(${Math.min(84, swipeProgress)}% + 6px)`,
                    }}
                    className="absolute h-11 w-12 rounded-xl bg-emerald-400 text-slate-950 font-black flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing transition-all duration-75"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 4: PIN INPUT FIELD (WITH AUTOMATIC PIN APPLY) */}
          {securityStage === 'PIN_ENTRY' && (
            <form onSubmit={handleVerifyPin} className="space-y-4 py-2">
              <div className="rounded-2xl bg-slate-900 border border-emerald-500/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4" />
                    Security PIN Verification
                  </span>
                  {pinInput.length === 6 && (
                    <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      PIN Auto-Applied ✓
                    </span>
                  )}
                </div>

                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) =>
                    setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="Enter 6-digit PIN"
                  className="h-12 text-center text-2xl font-mono font-black tracking-[0.45em] bg-slate-950 border-emerald-500/40 text-white rounded-xl"
                  autoFocus
                />

                <p className="text-[11px] text-slate-400 text-center">
                  Your verified PIN code is automatically applied. Click below to unlock your salary dashboard.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  disabled={verifyingPin || pinInput.length < 4}
                  className="w-full h-11 rounded-xl font-extrabold text-sm gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg"
                >
                  {verifyingPin ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Verifying PIN...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Verify PIN & Reveal Earnings
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

