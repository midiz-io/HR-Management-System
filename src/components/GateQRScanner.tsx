import React, { useState, useEffect, useRef } from 'react';
import QrScanner from 'qr-scanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
  Camera,
  QrCode,
  MapPin,
  UserCheck,
  UserMinus,
  AlertCircle,
  User,
  RefreshCw,
  Clock,
  Play,
  Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Location {
  id: string;
  name: string;
}

interface ScanEmployee {
  id: string;
  name: string;
  email: string;
  profileImage: string | null;
  position: string | null;
  department: string | null;
}

interface ScanResult {
  success: boolean;
  action: 'checked-in' | 'checked-out';
  employee: ScanEmployee;
  timestamp: string;
}

interface GateQRScannerProps {
  passcode?: string;
}

const GateQRScanner: React.FC<GateQRScannerProps> = ({ passcode }) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [cameras, setCameras] = useState<QrScanner.Camera[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [resultTimer, setResultTimer] = useState<number>(0);

  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);
  const lastScanRef = useRef<{ userId: string; time: number } | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch locations on mount
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch('/api/locations');
        if (response.ok) {
          const data = await response.json();
          setLocations(data);

          // Restore saved location if any
          const savedLocation = localStorage.getItem('gateScannerLocationId');
          if (savedLocation && data.some((loc: Location) => loc.id === savedLocation)) {
            setSelectedLocationId(savedLocation);
          } else if (data.length > 0) {
            setSelectedLocationId(data[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching locations:', error);
      }
    };

    fetchLocations();

    return () => {
      stopScanner();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Save location to localStorage when changed
  const handleLocationChange = (locId: string) => {
    setSelectedLocationId(locId);
    localStorage.setItem('gateScannerLocationId', locId);
  };

  // Start QR Scanner
  const startScanner = async () => {
    if (!videoRef.current) return;
    if (!selectedLocationId) {
      toast({
        variant: 'destructive',
        title: 'Gate Location Required',
        description: 'Please select your current Gate Location before starting the scanner.',
      });
      return;
    }

    try {
      stopScanner();
      setScanResult(null);

      const qrScanner = new QrScanner(
        videoRef.current,
        (result) => handleScan(result.data),
        {
          preferredCamera: selectedCameraId || 'environment',
          highlightScanRegion: true,
          highlightCodeOutline: true,
          onDecodeError: (error) => {
            // Silence decoding errors
          }
        }
      );

      qrScannerRef.current = qrScanner;
      await qrScanner.start();
      setIsScanning(true);

      // Get list of cameras
      const list = await QrScanner.listCameras(true);
      setCameras(list);
    } catch (error) {
      console.error('Failed to start scanner:', error);
      toast({
        variant: 'destructive',
        title: 'Scanner Error',
        description: 'Could not access the camera. Make sure you have granted camera permissions.',
      });
    }
  };

  // Stop QR Scanner
  const stopScanner = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    setIsScanning(false);
  };

  // Handle scanned QR code data
  const handleScan = async (decodedText: string) => {
    // Extract userId from verify URL
    let userId = decodedText;
    if (decodedText.includes('/verify/')) {
      const parts = decodedText.split('/verify/');
      userId = parts[parts.length - 1];
    }

    // Simple UUID pattern verification to avoid scanning wrong QR codes
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.warn('Scanned data is not a valid UUID:', userId);
      return;
    }

    // Prevent double scanning within 4 seconds
    const now = Date.now();
    if (lastScanRef.current && lastScanRef.current.userId === userId && now - lastScanRef.current.time < 4000) {
      return;
    }
    lastScanRef.current = { userId, time: now };

    // Process scan punch on server
    try {
      setLoading(true);
      // Play a quick scan notification sound if available
      try {
        const audio = new Audio('/sounds/beep.mp3');
        audio.volume = 0.2;
        audio.play().catch(() => {});
      } catch (e) {}

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (passcode) {
        headers['x-gate-passcode'] = passcode;
      }

      const response = await fetch('/api/admin/scan-punch', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId,
          locationId: selectedLocationId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to process check-in/out');
      }

      const result = await response.json();
      setScanResult(result);

      // Start result presentation countdown (4 seconds)
      setResultTimer(100);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      
      const interval = setInterval(() => {
        setResultTimer((prev) => {
          if (prev <= 2.5) {
            clearInterval(interval);
            setScanResult(null);
            return 0;
          }
          return prev - 2.5;
        });
      }, 100);
      countdownIntervalRef.current = interval;

      toast({
        title: result.action === 'checked-in' ? 'Employee Checked In' : 'Employee Checked Out',
        description: `${result.employee.name} has been successfully recorded.`,
      });
    } catch (error: any) {
      console.error('Scan punch error:', error);
      toast({
        variant: 'destructive',
        title: 'Verification Failed',
        description: error.message || 'Error communicating with gate attendance server.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCameraChange = async (cameraId: string) => {
    setSelectedCameraId(cameraId);
    if (qrScannerRef.current) {
      await qrScannerRef.current.setCamera(cameraId);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-7xl mx-auto">
      {/* Scanner Control Panel */}
      <Card className="xl:col-span-2 border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800/80">
          <CardTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Camera className="h-5 w-5 text-primary" />
            Gate Scanner Camera
          </CardTitle>
          <CardDescription>
            Select the current location and camera to start scanning ID cards.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Gate Location Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Active Gate Location
              </label>
              <select
                disabled={isScanning}
                value={selectedLocationId}
                onChange={(e) => handleLocationChange(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 transition-all"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Camera selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5" />
                Video Scanner Device
              </label>
              <select
                value={selectedCameraId}
                onChange={(e) => handleCameraChange(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="">Default (Environment)</option>
                {cameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Scanner Viewport */}
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-inner flex items-center justify-center">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
            />

            {/* Target Reticle Overlay */}
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                <div className="relative w-64 h-64 border-2 border-dashed border-white/40 rounded-3xl flex items-center justify-center shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  {/* Glowing corners */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl animate-pulse" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl animate-pulse" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl animate-pulse" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl animate-pulse" />
                  
                  {/* Laser line effect */}
                  <div className="w-full h-0.5 bg-primary/80 absolute shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-bounce" />
                </div>
              </div>
            )}

            {!isScanning && (
              <div className="flex flex-col items-center gap-3 p-6 text-center z-20">
                <div className="p-4 rounded-full bg-slate-900/80 border border-slate-800 text-slate-400">
                  <QrCode className="h-8 w-8" />
                </div>
                <h3 className="text-white font-bold">Scanner Offline</h3>
                <p className="text-slate-400 text-xs max-w-xs">
                  Press Start Scanner to access your camera and begin scanning ID card QR codes.
                </p>
                <Button
                  onClick={startScanner}
                  className="mt-2 rounded-xl shadow-lg shadow-primary/20 font-bold"
                >
                  <Play className="h-4 w-4 mr-2" /> Start Scanner
                </Button>
              </div>
            )}
          </div>

          {/* Start/Stop Button Controls */}
          {isScanning && (
            <div className="flex justify-end gap-2">
              <Button
                variant="destructive"
                onClick={stopScanner}
                className="rounded-xl font-bold"
              >
                <Square className="h-4 w-4 mr-2" /> Stop Scanner
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Real-time Scan Result Panel */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm rounded-2xl overflow-hidden flex flex-col">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800/80">
          <CardTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Scanner Feedback
          </CardTitle>
          <CardDescription>
            Live status feedback of scanned employee ID cards.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 flex-1 flex flex-col justify-center min-h-[300px]">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 text-center py-10"
              >
                <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm font-semibold text-muted-foreground">Verifying employee credentials...</p>
              </motion.div>
            ) : scanResult ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6 py-4"
              >
                {/* Status Indicator Banner */}
                <div className={`p-4 rounded-2xl flex items-center gap-3 border ${
                  scanResult.action === 'checked-in'
                    ? 'bg-green-50/55 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                    : 'bg-blue-50/55 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'
                }`}>
                  {scanResult.action === 'checked-in' ? (
                    <UserCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
                  ) : (
                    <UserMinus className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  )}
                  <div>
                    <h3 className="font-extrabold text-base tracking-tight leading-none mb-1">
                      {scanResult.action === 'checked-in' ? 'CHECKED IN SUCCESS' : 'CHECKED OUT SUCCESS'}
                    </h3>
                    <p className="text-xs opacity-90 font-medium">
                      Recorded at {new Date(scanResult.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  </div>
                </div>

                {/* Employee Details Card */}
                <div className="flex flex-col items-center text-center p-6 border border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-950/40 rounded-2xl relative overflow-hidden">
                  {/* Photo / Avatar */}
                  <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 mb-4 flex items-center justify-center">
                    {scanResult.employee.profileImage ? (
                      <img
                        src={scanResult.employee.profileImage}
                        alt={scanResult.employee.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="h-10 w-10 text-slate-400" />
                    )}
                  </div>

                  <h4 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 leading-tight">
                    {scanResult.employee.name}
                  </h4>
                  <p className="text-xs font-bold text-primary mt-1 uppercase tracking-wider">
                    {scanResult.employee.position || 'Staff Employee'}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">
                    {scanResult.employee.department || 'All Departments'}
                  </p>

                  <div className="w-full border-t border-slate-100 dark:border-slate-800/80 mt-4 pt-3 text-[11px] font-bold text-muted-foreground flex justify-between">
                    <span>STATUS</span>
                    <span className={scanResult.action === 'checked-in' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}>
                      ACTIVE {scanResult.action === 'checked-in' ? 'IN' : 'OUT'}
                    </span>
                  </div>
                </div>

                {/* Progress bar visual countdown */}
                <div className="space-y-1.5">
                  <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-100 ${
                        scanResult.action === 'checked-in' ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${resultTimer}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-center text-muted-foreground font-semibold">
                    Readying for next scan...
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 text-center py-10"
              >
                <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">
                  <QrCode className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-sm">Awaiting Scan</h3>
                <p className="text-muted-foreground text-xs max-w-xs leading-normal">
                  Position the back QR code of an employee ID card in front of the camera viewport to punch attendance.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
};

export default GateQRScanner;
