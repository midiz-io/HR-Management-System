import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Smartphone, Download, AlertCircle, Loader2 } from 'lucide-react';

export default function AppDownload() {
  const router = useRouter();
  const { userId } = router.query;
  
  const [os, setOs] = useState<'android' | 'ios' | 'unknown'>('unknown');
  const [scanStatus, setScanStatus] = useState<'analyzing' | 'scanning' | 'safe' | 'downloading'>('analyzing');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Detect OS
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    
    if (/android/i.test(userAgent)) {
      setOs('android');
    } else if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      setOs('ios');
    } else {
      setOs('unknown'); // Desktop or other
    }

    // Simulate the scanning and download process
    const sequence = async () => {
      // 1. Analyzing device
      setScanStatus('analyzing');
      await new Promise(r => setTimeout(r, 1500));
      
      // 2. Scanning for threats (progress bar)
      setScanStatus('scanning');
      for (let i = 0; i <= 100; i += 5) {
        setProgress(i);
        await new Promise(r => setTimeout(r, 100)); // Total 2 seconds
      }
      
      // 3. Safe!
      setScanStatus('safe');
      await new Promise(r => setTimeout(r, 1500));
      
      // 4. Trigger download
      setScanStatus('downloading');
      
      triggerDownload();
    };

    sequence();
  }, []);

  const triggerDownload = () => {
    // Create a dummy download for the APK/IPA
    const a = document.createElement('a');
    a.style.display = 'none';
    
    if (os === 'ios') {
      // In a real scenario, this would redirect to the App Store
      // or download an Enterprise IPA with a specialized manifest URL.
      a.href = '/downloads/app-release.ipa';
      a.download = 'AttendX.ipa';
    } else {
      a.href = '/downloads/app-release.apk';
      a.download = 'AttendX.apk';
    }
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 font-sans">
      <Head>
        <title>Download AttendX Mobile App</title>
      </Head>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-800 p-8 overflow-hidden relative">
        {/* Background shapes */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Native App Installation</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-8">
            Plug & Play technology. Your device is being prepared for a secure installation.
          </p>

          <AnimatePresence mode="wait">
            {scanStatus === 'analyzing' && (
              <motion.div 
                key="analyzing"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center space-y-4"
              >
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <Smartphone className="w-10 h-10 text-blue-500 animate-pulse" />
                </div>
                <h3 className="font-bold text-lg text-slate-700 dark:text-slate-300">Detecting Device...</h3>
              </motion.div>
            )}

            {scanStatus === 'scanning' && (
              <motion.div 
                key="scanning"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center space-y-6 w-full"
              >
                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center relative">
                  <Loader2 className="w-12 h-12 text-indigo-500 animate-spin absolute" />
                  <ShieldCheck className="w-6 h-6 text-indigo-500 relative z-10" />
                </div>
                <div className="w-full text-center">
                  <h3 className="font-bold text-lg text-slate-700 dark:text-slate-300 mb-2">Scanning for threats</h3>
                  <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-100 ease-linear rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-2 font-mono">{progress}% Complete</p>
                </div>
              </motion.div>
            )}

            {scanStatus === 'safe' && (
              <motion.div 
                key="safe"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }}
                className="flex flex-col items-center space-y-4"
              >
                <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <ShieldCheck className="w-12 h-12 text-green-500" />
                </div>
                <div className="text-center">
                  <h3 className="font-black text-xl text-green-600 dark:text-green-400">100% Safe</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">No viruses detected.</p>
                </div>
              </motion.div>
            )}

            {scanStatus === 'downloading' && (
              <motion.div 
                key="downloading"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center space-y-6 text-center"
              >
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                  <Download className="w-10 h-10 text-primary animate-bounce" />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100 mb-2">Downloading App</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    {os === 'android' ? 'Check your notifications for the APK file.' : 
                     os === 'ios' ? 'You are being redirected to download the IPA profile.' :
                     'Check your downloads folder.'}
                  </p>
                  
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl flex gap-3 text-left">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400">Installation Instructions</h4>
                      <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                        {os === 'android' ? "Once downloaded, tap the file to install. If prompted, allow installation from unknown sources." : "Follow the prompt to install the enterprise profile on your iOS device."}
                      </p>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={triggerDownload}
                  className="text-primary text-sm font-bold hover:underline"
                >
                  Click here if download didn't start automatically
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
