import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { FaCheckCircle, FaUser, FaBuilding, FaCalendarAlt, FaIdBadge, FaShieldAlt, FaStamp } from 'react-icons/fa';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface VerifiedUser {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  role: string;
  profileImage: string | null;
  sequentialId?: number;
  joinDate: string | null;
  createdAt: string;
  phoneNumber?: string;
  nic?: string;
  dob?: string;
  idCardStyle?: string;
  idCardLogoScale?: string;
}

const VerificationPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const [userData, setUserData] = useState<VerifiedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchVerificationData();
    }
  }, [id]);

  const fetchVerificationData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/user?id=${id}`);
      if (!response.ok) throw new Error('Identity not found');
      const data = await response.json();
      setUserData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getFormattedID = (user: VerifiedUser) => {
    const fInitial = user.firstName?.charAt(0) || '';
    const lInitial = user.lastName?.charAt(0) || '';
    const num = String(user.sequentialId || 0).padStart(3, '0');
    return `${fInitial}${lInitial}${num}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f7fa] dark:bg-slate-950 flex items-center justify-center p-6">
        <Card className="w-full max-w-lg border-none shadow-xl">
          <CardContent className="p-0">
             <div className="h-32 bg-slate-200 animate-pulse" />
             <div className="p-8 flex flex-col items-center gap-4">
                <Skeleton className="h-40 w-40 rounded-2xl -mt-20 border-4 border-white shadow-lg" />
                <Skeleton className="h-10 w-64 mt-4" />
                <Skeleton className="h-4 w-40" />
                <div className="w-full grid grid-cols-2 gap-4 mt-8">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
             </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !userData) {
    return (
      <div className="min-h-screen bg-[#f4f7fa] dark:bg-slate-950 flex items-center justify-center p-6 text-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FaShieldAlt className="text-red-600 h-12 w-12" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">IDENTITY NOT VERIFIED</h1>
          <p className="text-slate-500 max-w-md mx-auto">
            This identification record does not exist in the Tropical Shellfish Digital Registry or has been deactivated.
          </p>
          <Button variant="outline" onClick={() => router.push('/')} className="mt-6">Return to Home</Button>
        </motion.div>
      </div>
    );
  }

  const idCardStyle = userData.idCardStyle || 'default';
  const logoScale = Number(userData.idCardLogoScale || 100);

  return (
    <div className="min-h-screen bg-[#f4f7fa] dark:bg-slate-950 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden font-sans">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100/30 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-sky-100/30 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-2xl z-10"
      >
        <Card className={`border-none shadow-[0_35px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden rounded-[2.5rem] transition-all duration-500 relative ${
          idCardStyle === 'cyberpunk' ? 'bg-slate-950 border-2 border-fuchsia-500/50 text-slate-100 shadow-[0_0_30px_rgba(240,46,170,0.15)]' :
          idCardStyle === 'royal' ? 'bg-[#111111] border-2 border-[#d4af37]/80 text-[#f5f5f5] shadow-[0_15px_40px_rgba(0,0,0,0.5)]' :
          idCardStyle === 'glassmorphism' ? 'bg-white/20 dark:bg-slate-900/30 backdrop-blur-2xl border border-white/20 text-slate-900 dark:text-slate-100' :
          idCardStyle === 'tropical' ? 'bg-gradient-to-b from-[#e0f2fe] to-[#f0fdfa] dark:from-slate-900 dark:to-teal-950 border border-teal-200 dark:border-teal-900/50 text-slate-800 dark:text-slate-100' :
          'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
        }`}>
          {/* Centered Main Logo Watermark in Background */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden select-none opacity-[0.17] dark:opacity-[0.23] transition-opacity duration-300">
            <img 
              src="/images/logo.png" 
              alt="Main Watermark" 
              className="w-72 h-72 object-contain rotate-[-12deg]"
              onError={(e) => {
                (e.target as any).style.display = 'none';
                const fallback = (e.target as any).parentNode.querySelector('.svg-bg-watermark');
                if (fallback) fallback.style.display = 'block';
              }}
            />
            <div className="svg-bg-watermark hidden">
              <svg className="w-72 h-72 rotate-[-12deg] text-slate-800 dark:text-slate-200" viewBox="0 0 30 40" fill="currentColor">
                <path d="M15,10 C18,8 22,12 21,17 C20,22 17,25 18,30 C19,34 16,38 12,38 C8,38 7,33 9,28 C11,23 9,18 10,14 C11,10 12,12 15,10 Z" />
              </svg>
            </div>
          </div>

          {/* Header */}
          <div className={`relative h-48 flex items-center justify-between px-8 sm:px-12 overflow-hidden shadow-inner transition-all duration-500 z-10 ${
            idCardStyle === 'cyberpunk' ? 'bg-slate-900/80 border-b border-fuchsia-500/20' :
            idCardStyle === 'royal' ? 'bg-stone-900/60 border-b border-[#d4af37]/20' :
            idCardStyle === 'glassmorphism' ? 'bg-gradient-to-r from-pink-500/20 to-orange-400/20 border-b border-white/10' :
            idCardStyle === 'tropical' ? 'bg-gradient-to-br from-teal-600 to-cyan-500' :
            'bg-gradient-to-br from-blue-600 to-sky-500'
          }`}>
             <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />
             <div className="absolute inset-y-0 left-0 w-1/3 bg-white/5 skew-x-12 transform origin-top-left pointer-events-none" />
             
             <div className="z-10 flex flex-col text-white">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-80 mb-1">Official Verification</span>
                <h1 className={`text-2xl sm:text-3xl font-black tracking-tighter leading-none italic uppercase ${
                  idCardStyle === 'royal' ? 'text-[#d4af37]' : 'text-white'
                }`}>
                  TROPICAL SHELLFISH<br/>DIGITAL PASS
                </h1>
                <div className="flex items-center gap-2 mt-4">
                   <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest shadow-sm ${
                     idCardStyle === 'cyberpunk' ? 'bg-cyan-500 text-black' :
                     idCardStyle === 'royal' ? 'bg-[#d4af37] text-black' :
                     idCardStyle === 'glassmorphism' ? 'bg-pink-600 text-white' :
                     idCardStyle === 'tropical' ? 'bg-amber-500 text-white' :
                     'bg-white text-blue-600'
                   }`}>Verified Status</div>
                   <span className="text-[9px] font-black uppercase opacity-90">Auth Level: 04</span>
                </div>
             </div>
             
             <div className="z-10 hidden sm:block">
                <img 
                   src="/images/logo.png" 
                   alt="Tropical Shellfish Logo" 
                   className={`h-32 object-contain max-w-[220px] ${
                     idCardStyle === 'default' || idCardStyle === 'tropical' ? 'brightness-100' : 'brightness-0 invert'
                   }`}
                   onError={(e) => {
                     (e.target as any).style.display = 'none';
                     const fallback = (e.target as any).parentNode.querySelector('.svg-logo-fallback');
                     if (fallback) fallback.style.display = 'flex';
                   }}
                />
                <div className="svg-logo-fallback hidden flex-col items-center justify-center">
                  <svg className="w-10 h-12" style={{ color: idCardStyle === 'royal' ? '#d4af37' : idCardStyle === 'cyberpunk' ? '#e879f9' : '#ffffff' }} viewBox="0 0 30 40" fill="currentColor">
                    <path d="M15,10 C18,8 22,12 21,17 C20,22 17,25 18,30 C19,34 16,38 12,38 C8,38 7,33 9,28 C11,23 9,18 10,14 C11,10 12,12 15,10 Z" />
                    <circle cx="23" cy="7" r="2.5" fill="#f43f5e" />
                    <circle cx="18" cy="4" r="2.5" fill="#10b981" />
                    <circle cx="12" cy="5" r="2.5" fill="#3b82f6" />
                    <circle cx="8" cy="9" r="2.5" fill="#8b5cf6" />
                    <circle cx="6" cy="15" r="2" fill="#f59e0b" />
                  </svg>
                </div>
             </div>
          </div>
          
          <CardContent className="p-8 sm:p-12 pt-0 flex flex-col items-center relative z-10">
            {/* Shapes for glassmorphism / specific styles */}
            {idCardStyle === 'glassmorphism' && (
              <>
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-red-500/5 to-orange-400/10 pointer-events-none -z-10" />
                <div className="absolute -top-16 -left-16 w-36 h-36 rounded-full bg-pink-500/20 blur-2xl pointer-events-none" />
              </>
            )}
            
            {/* Profile Photo */}
            <div className="relative -mt-10 mb-8 z-10">
              <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-[2.5rem] overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                <div className="w-full h-full rounded-[2rem] overflow-hidden bg-white dark:bg-slate-900 flex items-center justify-center">
                  {userData.profileImage ? (
                    <img src={userData.profileImage} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                      <FaUser className="h-20 w-20 text-slate-300" />
                    </div>
                  )}
                </div>
              </div>
              <div className={`absolute -bottom-2 -right-2 p-2.5 rounded-2xl shadow-lg border ${
                idCardStyle === 'cyberpunk' ? 'bg-slate-900 border-fuchsia-500/30' :
                idCardStyle === 'royal' ? 'bg-stone-900 border-[#d4af37]/30' :
                'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
              }`}>
                 <FaCheckCircle className={`h-6 w-6 animate-pulse ${
                   idCardStyle === 'cyberpunk' ? 'text-cyan-400' :
                   idCardStyle === 'royal' ? 'text-[#d4af37]' :
                   idCardStyle === 'glassmorphism' ? 'text-pink-500' :
                   idCardStyle === 'tropical' ? 'text-teal-500' :
                   'text-blue-600'
                 }`} />
              </div>
            </div>

            <div className="text-center w-full mb-10">
              <h2 className={`text-3xl sm:text-4xl font-black tracking-tight leading-tight uppercase ${
                idCardStyle === 'cyberpunk' ? 'text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-purple-400 to-cyan-400 font-extrabold drop-shadow-[0_0_8px_rgba(240,46,170,0.2)]' :
                idCardStyle === 'royal' ? 'text-[#d4af37] font-serif' :
                idCardStyle === 'glassmorphism' ? 'text-slate-950 dark:text-white font-extrabold' :
                idCardStyle === 'tropical' ? 'text-teal-950 dark:text-teal-50' :
                'text-[#1b0b53] dark:text-white'
              }`}>
                {userData.firstName} {userData.lastName}
              </h2>
              <div className={`inline-block px-8 py-1.5 mt-3 rounded-full shadow-md ${
                idCardStyle === 'cyberpunk' ? 'bg-cyan-500 text-black font-black uppercase tracking-wider' :
                idCardStyle === 'royal' ? 'bg-[#d4af37] text-black font-serif font-black tracking-widest uppercase shadow-sm' :
                idCardStyle === 'glassmorphism' ? 'bg-white/60 dark:bg-black/40 text-pink-700 dark:text-pink-300 font-black shadow-sm' :
                idCardStyle === 'tropical' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold' :
                'bg-black text-white'
              }`}>
                <p className="font-black uppercase tracking-widest text-[10px]">
                  {userData.position || userData.role || 'STAFF'}
                </p>
              </div>
            </div>

            <div className="w-full space-y-4 max-w-md">
               <div className={`group p-5 rounded-3xl transition-all duration-300 hover:shadow-xl ${
                 idCardStyle === 'cyberpunk' ? 'bg-slate-900/60 border border-fuchsia-500/20 text-slate-100 hover:bg-slate-900 hover:shadow-fuchsia-500/5' :
                 idCardStyle === 'royal' ? 'bg-stone-900/60 border border-[#d4af37]/20 text-stone-200 hover:bg-stone-900 hover:shadow-[#d4af37]/5' :
                 idCardStyle === 'glassmorphism' ? 'bg-white/40 dark:bg-black/30 border border-white/20 hover:bg-white/50 dark:hover:bg-black/40' :
                 idCardStyle === 'tropical' ? 'bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/20 text-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/30' :
                 'bg-[#f8fafc] dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 hover:shadow-blue-500/5'
               }`}>
                 <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl shadow-sm ${
                      idCardStyle === 'cyberpunk' ? 'bg-slate-950 text-cyan-400' :
                      idCardStyle === 'royal' ? 'bg-black text-[#d4af37]' :
                      idCardStyle === 'glassmorphism' ? 'bg-white/60 text-pink-600 dark:bg-slate-900 dark:text-pink-400' :
                      idCardStyle === 'tropical' ? 'bg-white text-teal-600 dark:bg-slate-900 dark:text-teal-400' :
                      'bg-white dark:bg-slate-900 text-blue-600'
                    }`}>
                      <FaIdBadge className="h-5 w-5 animate-pulse" />
                    </div>
                    <div className="flex-1">
                      <p className={`text-[10px] uppercase font-black tracking-[0.2em] mb-0.5 text-left ${
                        idCardStyle === 'cyberpunk' ? 'text-cyan-400 font-mono' :
                        idCardStyle === 'royal' ? 'text-stone-400 font-serif' :
                        idCardStyle === 'glassmorphism' ? 'text-pink-600 dark:text-pink-400 font-bold' :
                        idCardStyle === 'tropical' ? 'text-teal-600 font-bold' :
                        'text-muted-foreground'
                      }`}>Employee ID No</p>
                      <p className={`text-lg font-black tracking-wider uppercase text-left font-mono ${
                        idCardStyle === 'cyberpunk' ? 'text-white' :
                        idCardStyle === 'royal' ? 'text-stone-200' :
                        idCardStyle === 'glassmorphism' ? 'text-slate-950 dark:text-white font-extrabold' :
                        idCardStyle === 'tropical' ? 'text-teal-950 dark:text-teal-100 font-black' :
                        'text-[#1b0b53] dark:text-white'
                      }`}>
                        {getFormattedID(userData)}
                      </p>
                    </div>
                 </div>
               </div>

              <div className={`group p-5 rounded-3xl transition-all duration-300 hover:shadow-xl ${
                idCardStyle === 'cyberpunk' ? 'bg-slate-900/60 border border-fuchsia-500/20 text-slate-100 hover:bg-slate-900 hover:shadow-fuchsia-500/5' :
                idCardStyle === 'royal' ? 'bg-stone-900/60 border border-[#d4af37]/20 text-stone-200 hover:bg-stone-900 hover:shadow-[#d4af37]/5' :
                idCardStyle === 'glassmorphism' ? 'bg-white/40 dark:bg-black/30 border border-white/20 hover:bg-white/50 dark:hover:bg-black/40' :
                idCardStyle === 'tropical' ? 'bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/20 text-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/30' :
                'bg-[#f8fafc] dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 hover:shadow-blue-500/5'
              }`}>
                <div className="flex items-center gap-4">
                   <div className={`p-3 rounded-2xl shadow-sm ${
                     idCardStyle === 'cyberpunk' ? 'bg-slate-950 text-cyan-400' :
                     idCardStyle === 'royal' ? 'bg-black text-[#d4af37]' :
                     idCardStyle === 'glassmorphism' ? 'bg-white/60 text-pink-600 dark:bg-slate-900 dark:text-pink-400' :
                     idCardStyle === 'tropical' ? 'bg-white text-teal-600 dark:bg-slate-900 dark:text-teal-400' :
                     'bg-white dark:bg-slate-900 text-blue-600'
                   }`}>
                     <FaIdBadge className="h-5 w-5" />
                   </div>
                   <div className="flex-1">
                     <p className={`text-[10px] uppercase font-black tracking-[0.2em] mb-0.5 text-left ${
                       idCardStyle === 'cyberpunk' ? 'text-cyan-400 font-mono' :
                       idCardStyle === 'royal' ? 'text-stone-400 font-serif' :
                       idCardStyle === 'glassmorphism' ? 'text-pink-600 dark:text-pink-400 font-bold' :
                       idCardStyle === 'tropical' ? 'text-teal-600 font-bold' :
                       'text-muted-foreground'
                     }`}>National Identity Card (NIC)</p>
                     <p className={`text-lg font-black tracking-wider uppercase text-left font-mono ${
                       idCardStyle === 'cyberpunk' ? 'text-white' :
                       idCardStyle === 'royal' ? 'text-stone-200' :
                       idCardStyle === 'glassmorphism' ? 'text-slate-950 dark:text-white font-extrabold' :
                       idCardStyle === 'tropical' ? 'text-teal-950 dark:text-teal-100 font-black' :
                       'text-[#1b0b53] dark:text-white'
                     }`}>
                       {userData.nic || 'Not Provided'}
                     </p>
                   </div>
                </div>
              </div>

              <div className={`group p-5 rounded-3xl transition-all duration-300 hover:shadow-xl ${
                idCardStyle === 'cyberpunk' ? 'bg-slate-900/60 border border-fuchsia-500/20 text-slate-100 hover:bg-slate-900 hover:shadow-fuchsia-500/5' :
                idCardStyle === 'royal' ? 'bg-stone-900/60 border border-[#d4af37]/20 text-stone-200 hover:bg-stone-900 hover:shadow-[#d4af37]/5' :
                idCardStyle === 'glassmorphism' ? 'bg-white/40 dark:bg-black/30 border border-white/20 hover:bg-white/50 dark:hover:bg-black/40' :
                idCardStyle === 'tropical' ? 'bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/20 text-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/30' :
                'bg-[#f8fafc] dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 hover:shadow-blue-500/5'
              }`}>
                <div className="flex items-center gap-4">
                   <div className={`p-3 rounded-2xl shadow-sm ${
                     idCardStyle === 'cyberpunk' ? 'bg-slate-950 text-cyan-400' :
                     idCardStyle === 'royal' ? 'bg-black text-[#d4af37]' :
                     idCardStyle === 'glassmorphism' ? 'bg-white/60 text-pink-600 dark:bg-slate-900 dark:text-pink-400' :
                     idCardStyle === 'tropical' ? 'bg-white text-teal-600 dark:bg-slate-900 dark:text-teal-400' :
                     'bg-white dark:bg-slate-900 text-blue-600'
                   }`}>
                     <FaUser className="h-5 w-5" />
                   </div>
                   <div className="flex-1">
                     <p className={`text-[10px] uppercase font-black tracking-[0.2em] mb-0.5 text-left ${
                       idCardStyle === 'cyberpunk' ? 'text-cyan-400 font-mono' :
                       idCardStyle === 'royal' ? 'text-stone-400 font-serif' :
                       idCardStyle === 'glassmorphism' ? 'text-pink-600 dark:text-pink-400 font-bold' :
                       idCardStyle === 'tropical' ? 'text-teal-600 font-bold' :
                       'text-muted-foreground'
                     }`}>Contact Number</p>
                     <p className={`text-lg font-black tracking-wider text-left font-mono ${
                       idCardStyle === 'cyberpunk' ? 'text-white' :
                       idCardStyle === 'royal' ? 'text-stone-200' :
                       idCardStyle === 'glassmorphism' ? 'text-slate-950 dark:text-white font-extrabold' :
                       idCardStyle === 'tropical' ? 'text-teal-950 dark:text-teal-100 font-black' :
                       'text-[#1b0b53] dark:text-white'
                     }`}>
                       {userData.phoneNumber || 'Not Provided'}
                     </p>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className={`group p-4 rounded-3xl transition-all duration-300 hover:shadow-xl ${
                  idCardStyle === 'cyberpunk' ? 'bg-slate-900/60 border border-fuchsia-500/20 text-slate-100 hover:bg-slate-900' :
                  idCardStyle === 'royal' ? 'bg-stone-900/60 border border-[#d4af37]/20 text-stone-200 hover:bg-stone-900' :
                  idCardStyle === 'glassmorphism' ? 'bg-white/40 dark:bg-black/30 border border-white/20 hover:bg-white/50' :
                  idCardStyle === 'tropical' ? 'bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/20 text-slate-800 hover:bg-teal-50' :
                  'bg-[#f8fafc] dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800'
                }`}>
                  <div className="flex items-center gap-3">
                     <div className={`p-2.5 rounded-xl shadow-sm ${
                       idCardStyle === 'cyberpunk' ? 'bg-slate-950 text-cyan-400' :
                       idCardStyle === 'royal' ? 'bg-black text-[#d4af37]' :
                       idCardStyle === 'glassmorphism' ? 'bg-white/60 text-pink-600 dark:bg-slate-900 dark:text-pink-400' :
                       idCardStyle === 'tropical' ? 'bg-white text-teal-600 dark:bg-slate-900 dark:text-teal-400' :
                       'bg-white dark:bg-slate-900 text-blue-600'
                     }`}>
                       <FaBuilding className="h-4 w-4" />
                     </div>
                     <div>
                       <p className={`text-[8px] uppercase font-black tracking-[0.2em] mb-0.5 text-left ${
                         idCardStyle === 'cyberpunk' ? 'text-cyan-400 font-mono' :
                         idCardStyle === 'royal' ? 'text-stone-400 font-serif' :
                         idCardStyle === 'glassmorphism' ? 'text-pink-600 dark:text-pink-400 font-bold' :
                         idCardStyle === 'tropical' ? 'text-teal-600 font-bold' :
                         'text-muted-foreground'
                       }`}>Role</p>
                       <p className="text-xs font-black uppercase text-left">{userData.role}</p>
                     </div>
                  </div>
                </div>

                <div className={`group p-4 rounded-3xl transition-all duration-300 hover:shadow-xl ${
                  idCardStyle === 'cyberpunk' ? 'bg-slate-900/60 border border-fuchsia-500/20 text-slate-100 hover:bg-slate-900' :
                  idCardStyle === 'royal' ? 'bg-stone-900/60 border border-[#d4af37]/20 text-stone-200 hover:bg-stone-900' :
                  idCardStyle === 'glassmorphism' ? 'bg-white/40 dark:bg-black/30 border border-white/20 hover:bg-white/50' :
                  idCardStyle === 'tropical' ? 'bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/20 text-slate-800 hover:bg-teal-50' :
                  'bg-[#f8fafc] dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800'
                }`}>
                  <div className="flex items-center gap-3">
                     <div className={`p-2.5 rounded-xl shadow-sm ${
                       idCardStyle === 'cyberpunk' ? 'bg-slate-950 text-cyan-400' :
                       idCardStyle === 'royal' ? 'bg-black text-[#d4af37]' :
                       idCardStyle === 'glassmorphism' ? 'bg-white/60 text-pink-600 dark:bg-slate-900 dark:text-pink-400' :
                       idCardStyle === 'tropical' ? 'bg-white text-teal-600 dark:bg-slate-900 dark:text-teal-400' :
                       'bg-white dark:bg-slate-900 text-blue-600'
                     }`}>
                       <FaCalendarAlt className="h-4 w-4" />
                     </div>
                     <div>
                       <p className={`text-[8px] uppercase font-black tracking-[0.2em] mb-0.5 text-left ${
                         idCardStyle === 'cyberpunk' ? 'text-cyan-400 font-mono' :
                         idCardStyle === 'royal' ? 'text-stone-400 font-serif' :
                         idCardStyle === 'glassmorphism' ? 'text-pink-600 dark:text-pink-400 font-bold' :
                         idCardStyle === 'tropical' ? 'text-teal-600 font-bold' :
                         'text-muted-foreground'
                       }`}>Member Since</p>
                       <p className="text-xs font-black uppercase text-left">
                         {userData.joinDate ? new Date(userData.joinDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : new Date(userData.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                       </p>
                     </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`mt-12 pt-8 border-t w-full ${
              idCardStyle === 'cyberpunk' ? 'border-fuchsia-500/20' :
              idCardStyle === 'royal' ? 'border-[#d4af37]/20' :
              'border-slate-100 dark:border-slate-800'
            }`}>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="text-center sm:text-left">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mb-1">Authenticated Signature</p>
                  <p className={`text-2xl font-black opacity-40 italic font-serif ${
                    idCardStyle === 'royal' ? 'text-[#d4af37]' :
                    idCardStyle === 'cyberpunk' ? 'text-fuchsia-400' :
                    'text-slate-400 dark:text-slate-600'
                  }`}>Tropical Shellfish Security</p>
                </div>
                <div className="flex flex-col items-center sm:items-end">
                   <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full animate-ping ${
                        idCardStyle === 'cyberpunk' ? 'bg-fuchsia-500' :
                        idCardStyle === 'royal' ? 'bg-[#d4af37]' :
                        'bg-blue-500'
                      }`} />
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                        idCardStyle === 'cyberpunk' ? 'text-cyan-400' :
                        idCardStyle === 'royal' ? 'text-[#d4af37] font-serif' :
                        idCardStyle === 'glassmorphism' ? 'text-pink-600 dark:text-pink-400 font-bold' :
                        idCardStyle === 'tropical' ? 'text-teal-600 font-bold' :
                        'text-blue-600'
                      }`}>Live Secure Record</span>
                   </div>
                   <p className="text-[9px] text-muted-foreground max-w-[200px] text-center sm:text-right italic">
                     This is an official verification record of Tropical Shellfish. Employment status is active and verified in real-time.
                   </p>
                </div>
              </div>
            </div>

            {/* Forensic Security Watermark Overlay */}
            <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden select-none opacity-[0.08] dark:opacity-[0.12] flex flex-col items-center justify-between py-6">
              {/* Diagonal repeating text lines */}
              <div className="w-full flex flex-col gap-12 rotate-[-25deg] scale-125 transform origin-center">
                <div className="whitespace-nowrap text-[8px] font-black uppercase tracking-[0.25em] text-slate-800 dark:text-slate-200">
                  {Array(10).fill("TROPICAL SHELLFISH SECURITY").join(" • ")}
                </div>
                <div className="whitespace-nowrap text-[8px] font-black uppercase tracking-[0.25em] text-slate-800 dark:text-slate-200 pl-24">
                  {Array(10).fill("OFFICIAL IDENTITY CARD VERIFIED").join(" • ")}
                </div>
                <div className="whitespace-nowrap text-[8px] font-black uppercase tracking-[0.25em] text-slate-800 dark:text-slate-200 pr-12">
                  {Array(10).fill("TROPICAL SHELLFISH SECURITY").join(" • ")}
                </div>
              </div>
              
              {/* Faint central hologram seal overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.12] dark:opacity-[0.16]">
                <svg className="w-48 h-48 text-slate-800 dark:text-slate-200 rotate-[15deg]" viewBox="0 0 30 40" fill="currentColor">
                  <path d="M15,10 C18,8 22,12 21,17 C20,22 17,25 18,30 C19,34 16,38 12,38 C8,38 7,33 9,28 C11,23 9,18 10,14 C11,10 12,12 15,10 Z" />
                </svg>
              </div>
            </div>
          </CardContent>
          
          {/* Bottom highlight bar */}
          <div className={`h-4 bg-gradient-to-r ${
            idCardStyle === 'cyberpunk' ? 'from-fuchsia-600 via-purple-600 to-cyan-500' :
            idCardStyle === 'royal' ? 'from-[#d4af37] via-stone-800 to-[#d4af37]' :
            idCardStyle === 'glassmorphism' ? 'from-pink-500 via-red-500 to-orange-400' :
            idCardStyle === 'tropical' ? 'from-teal-500 via-emerald-400 to-cyan-500' :
            'from-blue-600 via-sky-600 to-blue-600'
          }`} />
        </Card>
        
        <div className="mt-8 text-center">
           <p className="text-slate-400 text-xs font-medium uppercase tracking-[0.3em]">Tropical Shellfish Security Division • Sri Lanka</p>
        </div>
      </motion.div>
    </div>
  );
};

export default VerificationPage;
