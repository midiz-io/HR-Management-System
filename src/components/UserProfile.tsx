import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { FaUser, FaSpinner, FaSave, FaCamera, FaIdCard, FaDownload, FaShareAlt, FaPalette, FaBuilding } from 'react-icons/fa';
import { useAuth } from '@/contexts/AuthContext';
import NotificationSettings from './NotificationSettings';
import { createClient } from '@/util/supabase/component';
import { motion, AnimatePresence } from 'framer-motion';
import * as htmlToImage from 'html-to-image';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';

// Premium Themes for ID Cards
export const ID_THEMES = {
  default: {
    name: 'Default Classic',
    bg: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100',
    primaryText: 'text-[#1b0b53] dark:text-white',
    accentBg: 'bg-gradient-to-br from-blue-600 to-sky-500',
    logoClass: 'brightness-100',
    logoTextClass: 'text-[#1e40af]',
    logoSvgColor: '#1e40af',
    avatarBorder: 'border-[#2563eb]',
    pillBg: 'bg-black text-white',
    labelColor: 'text-slate-400 dark:text-slate-500 font-bold',
    colonsColor: 'text-slate-300 dark:text-slate-600',
    valueColor: 'text-[#1b0b53] dark:text-white font-mono',
    qrBg: 'bg-white',
    footerText: 'text-[#1b0b53]/80 dark:text-slate-300',
    signatureColor: 'text-[#2563eb]/70 dark:text-sky-400/70',
    frontShapes: (
      <>
        <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-30px] right-[-30px] w-40 h-40 bg-gradient-to-br from-blue-600 to-sky-500 rotate-45 transform origin-top-right rounded-3xl opacity-90 shadow-sm" />
          <div className="absolute top-[-60px] right-[-10px] w-40 h-40 bg-blue-400 rotate-45 transform origin-top-right rounded-3xl opacity-40" />
          <div className="absolute top-[-10px] right-[-60px] w-40 h-40 bg-sky-300 rotate-45 transform origin-top-right rounded-3xl opacity-30" />
        </div>
        <div className="absolute bottom-0 left-0 w-48 h-48 pointer-events-none overflow-hidden z-0">
          <div className="absolute bottom-[-30px] left-[-30px] w-40 h-40 bg-gradient-to-tr from-blue-600 to-sky-500 rotate-45 transform origin-bottom-left rounded-3xl opacity-90 shadow-sm" />
          <div className="absolute bottom-[-60px] left-[-10px] w-40 h-40 bg-blue-400 rotate-45 transform origin-bottom-left rounded-3xl opacity-40" />
          <div className="absolute bottom-[-10px] left-[-60px] w-40 h-40 bg-sky-300 rotate-45 transform origin-bottom-left rounded-3xl opacity-30" />
        </div>
      </>
    ),
    backShapes: (
      <>
        <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-30px] right-[-30px] w-40 h-40 bg-gradient-to-br from-blue-600 to-sky-500 rotate-45 transform origin-top-right rounded-3xl opacity-90 shadow-sm" />
          <div className="absolute top-[-60px] right-[-10px] w-40 h-40 bg-blue-400 rotate-45 transform origin-top-right rounded-3xl opacity-40" />
          <div className="absolute top-[-10px] right-[-60px] w-40 h-40 bg-sky-300 rotate-45 transform origin-top-right rounded-3xl opacity-30" />
        </div>
        <div className="absolute bottom-0 left-0 w-48 h-48 pointer-events-none overflow-hidden z-0">
          <div className="absolute bottom-[-30px] left-[-30px] w-40 h-40 bg-gradient-to-tr from-blue-600 to-sky-500 rotate-45 transform origin-bottom-left rounded-3xl opacity-90 shadow-sm" />
          <div className="absolute bottom-[-60px] left-[-10px] w-40 h-40 bg-blue-400 rotate-45 transform origin-bottom-left rounded-3xl opacity-40" />
          <div className="absolute bottom-[-10px] left-[-60px] w-40 h-40 bg-sky-300 rotate-45 transform origin-bottom-left rounded-3xl opacity-30" />
        </div>
      </>
    )
  },
  tropical: {
    name: 'Tropical Signature',
    bg: 'bg-gradient-to-b from-[#e0f2fe] to-[#f0fdfa] dark:from-slate-900 dark:to-teal-950/80 border border-teal-200 dark:border-teal-900/50 text-slate-800 dark:text-slate-100',
    primaryText: 'text-teal-950 dark:text-teal-50',
    accentBg: 'bg-gradient-to-br from-teal-600 to-cyan-500',
    logoClass: 'brightness-100',
    logoTextClass: 'text-teal-700 dark:text-teal-400',
    logoSvgColor: '#0f766e',
    avatarBorder: 'border-teal-500 shadow-md',
    pillBg: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold',
    labelColor: 'text-teal-600 dark:text-teal-400 font-bold',
    colonsColor: 'text-teal-300 dark:text-teal-700',
    valueColor: 'text-teal-950 dark:text-teal-100 font-black font-mono',
    qrBg: 'bg-white border border-teal-100 dark:border-teal-900/30',
    footerText: 'text-teal-900 dark:text-teal-300',
    signatureColor: 'text-orange-500/80 dark:text-orange-400/80',
    frontShapes: (
      <>
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-teal-400/20 blur-xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-44 h-44 rounded-full bg-cyan-400/20 blur-xl pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400" />
        <div className="absolute top-1/3 left-[-10px] w-6 h-20 bg-teal-500/10 rounded-r-full blur-sm" />
        <div className="absolute top-1/2 right-[-10px] w-6 h-20 bg-amber-500/10 rounded-l-full blur-sm" />
      </>
    ),
    backShapes: (
      <>
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-teal-400/20 blur-xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-44 h-44 rounded-full bg-cyan-400/20 blur-xl pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400" />
      </>
    )
  },
  cyberpunk: {
    name: 'Cyberpunk Tech',
    bg: 'bg-slate-950 border-2 border-fuchsia-500/50 text-slate-100 shadow-[0_0_20px_rgba(240,46,170,0.15)]',
    primaryText: 'text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-purple-400 to-cyan-400 font-extrabold',
    accentBg: 'bg-gradient-to-r from-fuchsia-600 to-purple-600',
    logoClass: 'brightness-0 invert drop-shadow-[0_0_8px_rgba(240,46,170,0.8)]',
    logoTextClass: 'text-fuchsia-400 drop-shadow-[0_0_8px_rgba(240,46,170,0.5)]',
    logoSvgColor: '#e879f9',
    avatarBorder: 'border-fuchsia-500 shadow-[0_0_15px_rgba(240,46,170,0.5)]',
    pillBg: 'bg-cyan-500 text-black font-black uppercase tracking-wider',
    labelColor: 'text-cyan-400 font-mono tracking-tighter',
    colonsColor: 'text-fuchsia-500',
    valueColor: 'text-white font-mono drop-shadow-[0_0_2px_rgba(34,211,238,0.3)]',
    qrBg: 'bg-slate-900 border border-fuchsia-500/30 p-1',
    footerText: 'text-cyan-400 font-mono',
    signatureColor: 'text-fuchsia-400/80 drop-shadow-[0_0_4px_rgba(240,46,170,0.5)]',
    frontShapes: (
      <>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:14px_24px] opacity-10 pointer-events-none" />
        <div className="absolute top-0 right-0 w-24 h-1 bg-fuchsia-500" />
        <div className="absolute bottom-0 left-0 w-24 h-1 bg-cyan-500" />
        <div className="absolute top-4 left-4 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        <div className="absolute bottom-4 right-4 w-2 h-2 rounded-full bg-fuchsia-400 animate-ping" />
      </>
    ),
    backShapes: (
      <>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:14px_24px] opacity-10 pointer-events-none" />
        <div className="absolute top-0 right-0 w-24 h-1 bg-fuchsia-500" />
        <div className="absolute bottom-0 left-0 w-24 h-1 bg-cyan-500" />
      </>
    )
  },
  royal: {
    name: 'Royal Gold',
    bg: 'bg-[#111111] border-2 border-[#d4af37]/80 text-[#f5f5f5] shadow-[0_15px_30px_rgba(0,0,0,0.6)]',
    primaryText: 'text-[#d4af37] font-serif uppercase tracking-wider',
    accentBg: 'bg-[#d4af37]',
    logoClass: 'brightness-0 invert drop-shadow-[0_2px_4px_rgba(212,175,55,0.4)]',
    logoTextClass: 'text-[#d4af37] tracking-widest font-serif',
    logoSvgColor: '#d4af37',
    avatarBorder: 'border-[#d4af37] shadow-[0_0_10px_rgba(212,175,55,0.3)]',
    pillBg: 'bg-[#d4af37] text-black font-serif font-black tracking-widest uppercase shadow-sm',
    labelColor: 'text-stone-400 uppercase tracking-widest text-[9px]',
    colonsColor: 'text-[#d4af37]/60',
    valueColor: 'text-stone-100 font-sans tracking-wide',
    qrBg: 'bg-white border border-[#d4af37]/30',
    footerText: 'text-[#d4af37]/90 font-serif',
    signatureColor: 'text-[#d4af37]/75 font-serif italic',
    frontShapes: (
      <>
        <div className="absolute top-2 left-2 right-2 bottom-2 border border-[#d4af37]/20 pointer-events-none" />
        <div className="absolute top-[-10px] left-1/2 transform -translate-x-1/2 w-20 h-4 bg-[#d4af37] rounded-b-md opacity-70" />
        <div className="absolute bottom-[-10px] left-1/2 transform -translate-x-1/2 w-20 h-4 bg-[#d4af37] rounded-t-md opacity-70" />
      </>
    ),
    backShapes: (
      <>
        <div className="absolute top-2 left-2 right-2 bottom-2 border border-[#d4af37]/20 pointer-events-none" />
        <div className="absolute top-[-10px] left-1/2 transform -translate-x-1/2 w-20 h-4 bg-[#d4af37] rounded-b-md opacity-70" />
      </>
    )
  },
  glassmorphism: {
    name: 'Sunset Glassmorphic',
    bg: 'bg-white/30 dark:bg-slate-900/40 backdrop-blur-xl border border-white/50 dark:border-slate-800/40 text-slate-900 dark:text-slate-100 shadow-2xl',
    primaryText: 'text-slate-950 dark:text-white drop-shadow-sm',
    accentBg: 'bg-gradient-to-r from-pink-500 to-orange-400',
    logoClass: 'brightness-100 drop-shadow-sm',
    logoTextClass: 'text-pink-600 dark:text-pink-400 font-extrabold',
    logoSvgColor: '#db2777',
    avatarBorder: 'border-white/60 shadow-xl',
    pillBg: 'bg-white/60 dark:bg-black/40 text-pink-700 dark:text-pink-300 font-black shadow-sm',
    labelColor: 'text-slate-700 dark:text-slate-300/80 uppercase tracking-widest font-bold',
    colonsColor: 'text-pink-400 dark:text-pink-500',
    valueColor: 'text-slate-950 dark:text-white font-extrabold font-mono',
    qrBg: 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-1.5',
    footerText: 'text-pink-600 dark:text-pink-400 font-semibold',
    signatureColor: 'text-orange-500/80 dark:text-orange-400/80',
    frontShapes: (
      <>
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 via-red-500/10 to-orange-400/20 pointer-events-none -z-10" />
        <div className="absolute -top-16 -left-16 w-36 h-36 rounded-full bg-pink-500/30 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-36 h-36 rounded-full bg-orange-400/30 blur-2xl pointer-events-none" />
      </>
    ),
    backShapes: (
      <>
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 via-red-500/10 to-orange-400/20 pointer-events-none -z-10" />
        <div className="absolute -top-16 -left-16 w-36 h-36 rounded-full bg-pink-500/30 blur-2xl pointer-events-none" />
      </>
    )
  }
};

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  role: string;
  profileImage: string | null;
  sequentialId?: number;
  joinDate?: string | null;
  createdAt?: string | null;
  phoneNumber?: string | null;
  nic?: string | null;
  dob?: string | null;
  idCardStyle?: string;
  idCardLogoScale?: string;
  department?: string | null;
}

const UserProfile: React.FC = () => {
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    position: '',
    phoneNumber: '',
    nic: '',
    dob: '',
  });
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
  const [fetchingBalances, setFetchingBalances] = useState<boolean>(false);
  const [showIDCard, setShowIDCard] = useState<boolean>(false);
  const [cardSide, setCardSide] = useState<'front' | 'back'>('front');
  const [cardBrand, setCardBrand] = useState<'tropical' | 'divron'>('tropical');
  
  // Custom Card style and logo scaling
  const [idCardStyle, setIdCardStyle] = useState<string>('default');
  const [idCardLogoScale, setIdCardLogoScale] = useState<number>(100);
  
  const { toast } = useToast();

  // Fetch user data on component mount
  useEffect(() => {
    fetchUserData();
    fetchLeaveBalances();
  }, []);

  // Fetch leave balances from API
  const fetchLeaveBalances = async () => {
    try {
      setFetchingBalances(true);
      const response = await fetch(`/api/leave-balances?year=${new Date().getFullYear()}`);
      if (response.ok) {
        const data = await response.json();
        setLeaveBalances(data);
      }
    } catch (error) {
      console.error('Error fetching leave balances:', error);
    } finally {
      setFetchingBalances(false);
    }
  };

  // Fetch user data from API
  const fetchUserData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user');
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      const data = await response.json();
      setUserData(data);
      setFormData({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        position: data.position || '',
        phoneNumber: data.phoneNumber || '',
        nic: data.nic || '',
        dob: data.dob || '',
      });
      setProfileImage(data.profileImage || null);
      setIdCardStyle(data.idCardStyle || 'default');
      setIdCardLogoScale(Number(data.idCardLogoScale || 100));
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch user data',
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-save ID Card settings
  const saveCardSettings = async (style: string, scale: number) => {
    try {
      const response = await fetch('/api/user', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idCardStyle: style,
          idCardLogoScale: String(scale),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update card settings');
      }
      const data = await response.json();
      setUserData(data);
    } catch (error) {
      console.error('Error auto-saving ID card settings:', error);
      toast({
        variant: 'destructive',
        title: 'Auto-save Failed',
        description: 'Your ID card design preferences could not be synchronized.',
      });
    }
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);

      // Send update user request
      const response = await fetch('/api/user', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });

      // Update user data
      setUserData(data);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update profile',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Photo Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid File', description: 'Please upload an image.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File Too Large', description: 'Max size is 5MB.' });
      return;
    }

    try {
      setUploading(true);
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Math.random()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('id-cards')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('id-cards')
        .getPublicUrl(filePath);

      // Update user profile with new image URL
      const response = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileImage: publicUrl }),
      });

      if (!response.ok) throw new Error('Failed to update profile image');

      setProfileImage(publicUrl);
      toast({ title: 'Success', description: 'Profile photo updated' });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
    } finally {
      setUploading(false);
    }
  };

  // Share ID Card as PNG
  const shareIDCard = async () => {
    const node = document.getElementById('id-card-display');
    if (!node) return;

    try {
      toast({
        title: "Preparing Identity...",
        description: "Generating high-quality image for sharing.",
      });

      // Increase scale for better quality
      const dataUrl = await htmlToImage.toPng(node, {
        quality: 1,
        pixelRatio: 3,
        backgroundColor: '#ffffff'
      });

      // Convert data URL to Blob
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${formData.firstName}_Identity_Pass.png`, { type: 'image/png' });

      // Check if sharing is supported
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Identity Pass - ${formData.firstName} ${formData.lastName}`,
          text: `Professional Identity Pass for ${formData.firstName} ${formData.lastName} (${cardBrand === 'divron' ? 'Divron Bio Ventures' : 'Tropical Shellfish'} Division).`,
        });
      } else {
        // Fallback to download if sharing is not supported
        const link = document.createElement('a');
        link.download = `${formData.firstName}_Identity_Pass.png`;
        link.href = dataUrl;
        link.click();
        
        toast({
          title: "Image Downloaded",
          description: "Sharing is not supported on this browser, so we've downloaded the image for you.",
        });
      }
    } catch (error) {
      console.error('Error sharing ID card:', error);
      toast({
        variant: 'destructive',
        title: 'Sharing Failed',
        description: 'Failed to generate the identity image.',
      });
    }
  };

  // Download ID Card as High-Quality PDF (both Front and Back sides)
  const downloadPDF = async () => {
    const node = document.getElementById('id-card-display');
    if (!node) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'ID Card preview display not found.',
      });
      return;
    }

    try {
      toast({
        title: "Generating High-Res PDF...",
        description: "Capturing both front and back sides.",
      });

      const originalSide = cardSide;

      // 1. Capture Front Side
      setCardSide('front');
      // Wait for React rendering state update and SVG/Image loads
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      const frontDataUrl = await htmlToImage.toPng(node, {
        quality: 1,
        pixelRatio: 4, // Ultra-high resolution
        backgroundColor: '#ffffff'
      });

      // 2. Capture Back Side
      setCardSide('back');
      // Wait for React rendering state update and SVG/Image loads
      await new Promise((resolve) => setTimeout(resolve, 250));
      
      const backDataUrl = await htmlToImage.toPng(node, {
        quality: 1,
        pixelRatio: 4, // Ultra-high resolution
        backgroundColor: '#ffffff'
      });

      // Restore original view side
      setCardSide(originalSide);

      // CR80 dimensions in mm: 53.98mm x 85.6mm (we use 54 x 86)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [54, 86]
      });

      // Page 1: Front
      doc.addImage(frontDataUrl, 'PNG', 0, 0, 54, 86);

      // Page 2: Back
      doc.addPage([54, 86], 'portrait');
      doc.addImage(backDataUrl, 'PNG', 0, 0, 54, 86);

      // Save the file
      doc.save(`${formData.firstName || 'Employee'}_ID_Card.pdf`);

      toast({
        title: "PDF Saved Successfully",
        description: "Your professional high-resolution ID card PDF has been downloaded.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        variant: 'destructive',
        title: 'PDF Generation Failed',
        description: 'Failed to generate the high-quality PDF.',
      });
    }
  };

  // Generate Unique ID Code (e.g., KW001)
  const getFormattedID = () => {
    const fInitial = formData.firstName?.charAt(0) || '';
    const lInitial = formData.lastName?.charAt(0) || '';
    const num = String(userData?.sequentialId || 0).padStart(3, '0');
    return `${fInitial}${lInitial}${num}`;
  };

  const getFullIDString = () => {
    return `${formData.firstName} ${formData.lastName} _ ${getFormattedID()}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>User Profile</CardTitle>
          <CardDescription>
            Update your personal information
          </CardDescription>
        </CardHeader>
        {loading ? (
          <CardContent className="flex justify-center py-6">
            <FaSpinner className="animate-spin h-6 w-6 text-primary" />
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center justify-center space-y-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary/20 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-inner transition-all group-hover:border-primary/50">
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <FaUser className="w-16 h-16 text-slate-300" />
                    )}
                  </div>
                  <label 
                    htmlFor="photo-upload" 
                    className="absolute bottom-1 right-1 bg-primary text-white p-2 rounded-full cursor-pointer shadow-lg hover:bg-primary/90 transition-transform active:scale-95"
                  >
                    {uploading ? <FaSpinner className="animate-spin w-4 h-4" /> : <FaCamera className="w-4 h-4" />}
                    <input 
                      id="photo-upload" 
                      type="file" 
                      className="hidden" 
                      onChange={handlePhotoUpload} 
                      accept="image/*"
                      disabled={uploading}
                    />
                  </label>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold">{formData.firstName} {formData.lastName}</h3>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">{formData.position || 'Professional'}</p>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowIDCard(!showIDCard)}
                  className="rounded-full gap-2 border-primary/20 text-primary hover:bg-primary/5"
                >
                  <FaIdCard /> {showIDCard ? 'Hide ID Card' : 'Generate ID Card'}
                </Button>
              </div>

              <AnimatePresence>
                {showIDCard && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="flex flex-col items-center py-8 w-full"
                  >
                    {/* The ID Card Display Area */}
                    {(() => {
                      const activeTheme = ID_THEMES[idCardStyle as keyof typeof ID_THEMES] || ID_THEMES.default;
                      return (
                        <>
                          <div id="id-card-display" className={`w-[320px] h-[480px] rounded-[30px] shadow-2xl overflow-hidden relative flex flex-col items-center font-sans ${activeTheme.bg}`}>
                            {cardSide === 'front' ? activeTheme.frontShapes : activeTheme.backShapes}

                            {/* Centered Main Logo Watermark in Background */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden select-none opacity-[0.17] dark:opacity-[0.23] transition-opacity duration-300">
                              <img 
                                src={cardBrand === 'divron' ? "/images/divron-logo.png" : "/images/logo.png"} 
                                alt="Main Watermark" 
                                className="w-60 h-60 object-contain rotate-[-12deg]"
                                onError={(e) => {
                                  (e.target as any).style.display = 'none';
                                  const fallback = (e.target as any).parentNode.querySelector('.svg-bg-watermark');
                                  if (fallback) fallback.style.display = 'block';
                                }}
                              />
                              <div className="svg-bg-watermark hidden">
                                <svg className="w-60 h-60 rotate-[-12deg] text-slate-800 dark:text-slate-200" viewBox="0 0 30 40" fill="currentColor">
                                  <path d="M15,10 C18,8 22,12 21,17 C20,22 17,25 18,30 C19,34 16,38 12,38 C8,38 7,33 9,28 C11,23 9,18 10,14 C11,10 12,12 15,10 Z" />
                                </svg>
                              </div>
                            </div>

                            {cardSide === 'front' ? (
                              /* FRONT CARD SIDE */
                              <div className="w-full h-full flex flex-col items-center z-10 relative">
                                {/* Tropical Shellfish Logo */}
                                <div className="w-full flex-shrink-0 flex flex-col items-center justify-center pt-4 pb-1 z-10">
                                  <img 
                                    src={cardBrand === 'divron' ? "/images/divron-logo.png" : "/images/logo.png"} 
                                    alt={`${cardBrand === 'divron' ? 'Divron Bio Ventures' : 'Tropical Shellfish'} Logo`} 
                                    className={`h-[150px] object-contain max-w-[95%] ${activeTheme.logoClass}`}
                                    onError={(e) => {
                                      (e.target as any).style.display = 'none';
                                      const fallback = (e.target as any).parentNode.querySelector('.svg-fallback');
                                      if (fallback) fallback.style.display = 'flex';
                                    }}
                                  />
                                  <div className="svg-fallback hidden flex-col items-center justify-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <svg className="w-12 h-16" style={{ color: activeTheme.logoSvgColor }} viewBox="0 0 30 40" fill="currentColor">
                                        <path d="M15,10 C18,8 22,12 21,17 C20,22 17,25 18,30 C19,34 16,38 12,38 C8,38 7,33 9,28 C11,23 9,18 10,14 C11,10 12,12 15,10 Z" />
                                        <circle cx="23" cy="7" r="2.5" fill="#f43f5e" />
                                        <circle cx="18" cy="4" r="2.5" fill="#10b981" />
                                        <circle cx="12" cy="5" r="2.5" fill="#3b82f6" />
                                        <circle cx="8" cy="9" r="2.5" fill="#8b5cf6" />
                                        <circle cx="6" cy="15" r="2" fill="#f59e0b" />
                                      </svg>
                                      <span className={`font-serif italic font-black text-3xl tracking-tight ${activeTheme.logoTextClass}`}>
                                        {cardBrand === 'divron' ? 'Divron Bio Ventures' : 'Tropical Shellfish'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Profile Image with border removed */}
                                <div className="mt-1 z-10 w-[130px] h-[130px] flex-shrink-0 rounded-[32px] overflow-hidden bg-slate-100 dark:bg-slate-850 flex items-center justify-center">
                                  {profileImage ? (
                                    <img src={profileImage} alt="User" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                                      <FaUser className="w-14 h-14 text-slate-300" />
                                    </div>
                                  )}
                                </div>

                                {/* User Name */}
                                <h2 className={`text-xl font-black tracking-tight mt-3 mb-1 text-center uppercase px-4 leading-tight flex-shrink-0 ${activeTheme.primaryText}`}>
                                  {formData.firstName} {formData.lastName}
                                </h2>

                                {/* Designation pill */}
                                <div className={`px-6 py-1 flex-shrink-0 rounded-full text-[10px] font-black tracking-widest uppercase shadow-sm mt-0.5 ${activeTheme.pillBg}`}>
                                  {formData.position || userData?.role || 'STAFF'}
                                </div>

                                {/* aligned colons layout */}
                                <div className="mt-5 mb-4 flex-shrink-0 flex flex-col items-center justify-center w-full px-6">
                                  <div className="text-[12px] font-black tracking-wider space-y-3.5 min-w-[210px] w-fit">
                                    <div className="grid grid-cols-[60px_10px_1fr] items-center">
                                      <span className={`text-left font-black uppercase ${activeTheme.labelColor}`}>ID NO</span>
                                      <span className={`text-center font-bold ${activeTheme.colonsColor}`}>:</span>
                                      <span className={`text-left font-black uppercase pl-1 font-mono ${activeTheme.valueColor}`}>{formData.nic || '—'}</span>
                                    </div>
                                    <div className="grid grid-cols-[60px_10px_1fr] items-center">
                                      <span className={`text-left font-black uppercase ${activeTheme.labelColor}`}>PHONE</span>
                                      <span className={`text-center font-bold ${activeTheme.colonsColor}`}>:</span>
                                      <span className={`text-left font-black pl-1 font-mono ${activeTheme.valueColor}`}>{formData.phoneNumber || '—'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* BACK CARD SIDE */
                              <div className="w-full h-full flex flex-col items-center z-10 relative">
                                {/* Tropical Shellfish Logo */}
                                <div className="w-full flex flex-col items-center justify-center pt-3 pb-0 z-10 flex-shrink-0">
                                  <img 
                                    src={cardBrand === 'divron' ? "/images/divron-logo.png" : "/images/logo.png"} 
                                    alt={`${cardBrand === 'divron' ? 'Divron Bio Ventures' : 'Tropical Shellfish'} Logo`} 
                                    style={{ height: '170px' }}
                                    className={`object-contain max-w-[90%] ${activeTheme.logoClass}`}
                                    onError={(e) => {
                                      (e.target as any).style.display = 'none';
                                      const fallback = (e.target as any).parentNode.querySelector('.svg-fallback');
                                      if (fallback) fallback.style.display = 'flex';
                                    }}
                                  />
                                  <div className="svg-fallback hidden flex-col items-center justify-center">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                      <svg className="w-24 h-28" style={{ color: activeTheme.logoSvgColor }} viewBox="0 0 30 40" fill="currentColor">
                                        <path d="M15,10 C18,8 22,12 21,17 C20,22 17,25 18,30 C19,34 16,38 12,38 C8,38 7,33 9,28 C11,23 9,18 10,14 C11,10 12,12 15,10 Z" />
                                        <circle cx="23" cy="7" r="2.5" fill="#f43f5e" />
                                        <circle cx="18" cy="4" r="2.5" fill="#10b981" />
                                        <circle cx="12" cy="5" r="2.5" fill="#3b82f6" />
                                        <circle cx="8" cy="9" r="2.5" fill="#8b5cf6" />
                                        <circle cx="6" cy="15" r="2" fill="#f59e0b" />
                                      </svg>
                                      <span className={`font-serif italic font-black text-3xl tracking-tight ${activeTheme.logoTextClass}`}>
                                        {cardBrand === 'divron' ? 'Divron Bio Ventures' : 'Tropical Shellfish'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* QR Code Container */}
                                <div className="flex-1 flex flex-col items-center justify-center z-10 w-full px-6 pt-2">
                                  <div className={`p-3 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-800 mb-1.5 flex items-center justify-center ${activeTheme.qrBg}`}>
                                    <QRCodeSVG 
                                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/verify/${user?.id}`}
                                      size={100}
                                      level="H"
                                    />
                                  </div>
                                  <p className={`text-center text-[10px] font-black uppercase tracking-widest mb-1 ${activeTheme.footerText}`}>
                                    Digital Registry Record
                                  </p>
                                  <p className={`text-center text-[9px] max-w-[200px] leading-normal mb-1.5 font-semibold ${activeTheme.footerText} opacity-85`}>
                                    Scan using a smartphone to instantly verify employment credentials and identity check.
                                  </p>
                                  
                                  <div className="w-full border-t border-slate-200/20 dark:border-slate-800/20 pt-1.5 flex flex-col items-center">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Authorized Signature</span>
                                    <span className={`font-serif italic text-base mt-0.5 select-none font-bold ${activeTheme.signatureColor}`}>
                                      {cardBrand === 'divron' ? 'Divron Bio Ventures' : 'Tropical Shellfish'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Forensic Security Watermark Overlay */}
                            <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden select-none opacity-[0.08] dark:opacity-[0.12] flex flex-col items-center justify-between py-6">
                              {/* Diagonal repeating text lines */}
                              <div className="w-full flex flex-col gap-12 rotate-[-25deg] scale-125 transform origin-center">
                                <div className="whitespace-nowrap text-[8px] font-black uppercase tracking-[0.25em] text-slate-800 dark:text-slate-200">
                                  {Array(10).fill(cardBrand === 'divron' ? "DIVRON BIO VENTURES SECURITY" : "TROPICAL SHELLFISH SECURITY").join(" • ")}
                                </div>
                                <div className="whitespace-nowrap text-[8px] font-black uppercase tracking-[0.25em] text-slate-800 dark:text-slate-200 pl-24">
                                  {Array(10).fill("OFFICIAL IDENTITY CARD VERIFIED").join(" • ")}
                                </div>
                                <div className="whitespace-nowrap text-[8px] font-black uppercase tracking-[0.25em] text-slate-800 dark:text-slate-200 pr-12">
                                  {Array(10).fill(cardBrand === 'divron' ? "DIVRON BIO VENTURES SECURITY" : "TROPICAL SHELLFISH SECURITY").join(" • ")}
                                </div>
                              </div>
                              
                              {/* Faint central hologram seal overlay */}
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.12] dark:opacity-[0.16]">
                                <svg className="w-48 h-48 text-slate-800 dark:text-slate-200 rotate-[15deg]" viewBox="0 0 30 40" fill="currentColor">
                                  <path d="M15,10 C18,8 22,12 21,17 C20,22 17,25 18,30 C19,34 16,38 12,38 C8,38 7,33 9,28 C11,23 9,18 10,14 C11,10 12,12 15,10 Z" />
                                </svg>
                              </div>
                            </div>
                          </div>

                          {/* ID Card Customization Tools */}
                          <div className="w-full max-w-[320px] bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl p-4 mt-6 space-y-4">
                            
                            {/* Card Brand Toggle (Only for Divron Hatchery) */}
                            {userData?.department === 'Divron Hatchery' && (
                              <div className="space-y-2 pb-2.5 border-b border-slate-200/60 dark:border-slate-800/60">
                                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  <FaBuilding className="text-primary text-sm" />
                                  <span>Select Company Brand</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setCardBrand('tropical')}
                                    className={`p-2.5 rounded-xl text-[10px] font-bold text-left border-2 transition-all leading-tight flex flex-col justify-between h-[60px] ${
                                      cardBrand === 'tropical' 
                                        ? 'border-primary bg-primary/5 text-primary shadow-sm font-black' 
                                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    <span>Tropical Bio</span>
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] text-white ${cardBrand === 'tropical' ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`}>
                                      {cardBrand === 'tropical' ? '✓' : ''}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCardBrand('divron')}
                                    className={`p-2.5 rounded-xl text-[10px] font-bold text-left border-2 transition-all leading-tight flex flex-col justify-between h-[60px] ${
                                      cardBrand === 'divron' 
                                        ? 'border-primary bg-primary/5 text-primary shadow-sm font-black' 
                                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    <span>Divron Bio</span>
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] text-white ${cardBrand === 'divron' ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`}>
                                      {cardBrand === 'divron' ? '✓' : ''}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Theme Selector */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                <FaPalette className="text-primary text-sm animate-pulse" />
                                <span>Select Design Theme</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {Object.keys(ID_THEMES).map((key) => {
                                  const themeObj = ID_THEMES[key as keyof typeof ID_THEMES];
                                  const isSelected = idCardStyle === key;
                                  return (
                                    <button
                                      key={key}
                                      type="button"
                                      onClick={() => {
                                        setIdCardStyle(key);
                                        saveCardSettings(key, idCardLogoScale);
                                      }}
                                      className={`p-2.5 rounded-xl text-[10px] font-bold text-left border-2 transition-all leading-tight flex flex-col justify-between h-[68px] ${
                                        isSelected 
                                          ? 'border-primary bg-primary/5 text-primary shadow-sm font-black' 
                                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                                      }`}
                                    >
                                      <span>{themeObj.name}</span>
                                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] text-white ${isSelected ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`}>
                                        {isSelected ? '✓' : ''}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>


                          </div>
                        </>
                      );
                    })()}

                    {/* Premium Card Flip Toggle Switch */}
                    <div className="flex items-center justify-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-full w-fit mx-auto mt-5 mb-2 shadow-inner border border-slate-200/50 dark:border-slate-700/50">
                      <button
                        type="button"
                        onClick={() => setCardSide('front')}
                        className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                          cardSide === 'front'
                            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-md font-bold'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        Front Side
                      </button>
                      <button
                        type="button"
                        onClick={() => setCardSide('back')}
                        className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                          cardSide === 'back'
                            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-md font-bold'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        Back Side
                      </button>
                    </div>
                    
                    {/* Capturing options */}
                    <div className="flex flex-col gap-3 w-full max-w-[320px] mt-4">
                       <Button 
                        onClick={shareIDCard} 
                        className="w-full h-14 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all font-bold text-base"
                       >
                          <FaShareAlt className="text-xl" />
                          <div className="flex flex-col items-start leading-tight">
                             <span className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">Share with others</span>
                             <span className="text-lg font-black tracking-tight uppercase">Share {cardSide === 'front' ? 'Front' : 'Back'}</span>
                          </div>
                       </Button>
                       
                       <Button 
                        className="w-full h-14 rounded-2xl bg-black text-white hover:bg-zinc-900 border-2 border-zinc-800 shadow-xl flex items-center justify-center gap-3 group transition-all active:scale-[0.98]"
                        onClick={shareIDCard}
                       >
                          <div className="w-10 h-7 bg-white/10 rounded flex items-center justify-center">
                             <FaIdCard className="text-lg text-white" />
                          </div>
                          <div className="flex flex-col items-start leading-tight font-bold">
                             <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-left">Export to gallery</span>
                             <span className="text-lg font-black tracking-tight uppercase">SAVE TO MOBILE</span>
                          </div>
                          <div className="ml-auto w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                             <FaDownload className="text-xs text-white" />
                          </div>
                       </Button>

                       <Button 
                        type="button"
                        className="w-full h-14 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-700 hover:to-rose-700 shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                        onClick={downloadPDF}
                       >
                          <div className="w-10 h-7 bg-white/10 rounded flex items-center justify-center">
                             <FaDownload className="text-lg text-white" />
                          </div>
                          <div className="flex flex-col items-start leading-tight font-bold">
                             <span className="text-[10px] font-bold text-rose-100 uppercase tracking-widest text-left">Print PDF Document</span>
                             <span className="text-lg font-black tracking-tight uppercase">PRINT BOTH SIDES</span>
                          </div>
                       </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted h-12 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="John"
                    className="h-12 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Doe"
                    className="h-12 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Real Position / Title</Label>
                <Input
                  id="position"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  placeholder="e.g. Senior Software Architect"
                  className="h-12 rounded-xl"
                />
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest pl-1">This title will appear on your official ID card</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nic">National ID No (NIC)</Label>
                <Input
                  id="nic"
                  name="nic"
                  value={formData.nic}
                  onChange={handleInputChange}
                  placeholder="e.g. 976400534V"
                  className="h-12 rounded-xl"
                />
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest pl-1">Your National ID number for the card</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  placeholder="e.g. +94752277019"
                  className="h-12 rounded-xl"
                />
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest pl-1">Your contact phone number for the card</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth (D.O.B)</Label>
                <Input
                  id="dob"
                  name="dob"
                  value={formData.dob}
                  onChange={handleInputChange}
                  placeholder="e.g. 1997/05/19"
                  className="h-12 rounded-xl"
                />
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest pl-1">Your Date of Birth for the card</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={userData?.role || 'EMPLOYEE'}
                  disabled
                  className="bg-muted h-12 rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  Your role determines your permissions in the system. Contact an administrator to change your role.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Join Date</Label>
                <Input
                  value={userData?.joinDate ? new Date(userData.joinDate).toLocaleDateString() : (userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : '')}
                  placeholder="—"
                  disabled
                  className="bg-muted h-12 rounded-xl"
                />
                 <p className="text-xs text-muted-foreground">
                  Your official join date as set by an administrator. This is used for attendance and leave calculations.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl shadow-lg shadow-primary/20"
              >
                {submitting ? (
                  <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FaSave className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>

      <Card className="border-none sm:border-solid shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Leave Quota Summary ({new Date().getFullYear()})</CardTitle>
          <CardDescription>
            Your current leave entitlement and remaining balance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fetchingBalances ? (
            <div className="flex justify-center py-6">
              <FaSpinner className="animate-spin h-6 w-6 text-primary" />
            </div>
          ) : leaveBalances.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {leaveBalances.map((balance) => {
                const remaining = balance.totalDays - balance.usedDays - balance.pendingDays;
                return (
                  <div key={balance.id} className="p-4 border rounded-xl bg-slate-50 dark:bg-slate-900 shadow-sm transition-all hover:shadow-md">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      {balance.leaveType.name}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className={`text-3xl font-black ${remaining <= 0 ? 'text-red-500' : 'text-primary'}`}>
                          {remaining}
                        </span>
                        <span className="text-xs text-muted-foreground">days left</span>
                      </div>
                      <div className="space-y-1 mt-auto">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Entitlement:</span>
                          <span className="font-semibold">{balance.totalDays}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Used:</span>
                          <span className="font-semibold">{balance.usedDays}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Pending:</span>
                          <span className="font-semibold text-yellow-600 dark:text-yellow-400">{balance.pendingDays}</span>
                        </div>
                      </div>
                      {remaining <= 0 && (
                        <div className="mt-3 py-1 px-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold text-center rounded-md border border-red-200 dark:border-red-800">
                          QUOTA EXPIRED
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground italic">
              No leave balances initialized for this year.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-none sm:border-solid shadow-sm mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
            Native Mobile App Access
          </CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-400">
            Scan this QR code with your smartphone to download and install our Native Mobile App. Works for both Android and iOS!
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row items-center justify-center gap-8">
          <div className="bg-white p-4 rounded-3xl shadow-xl shadow-indigo-200/50 dark:shadow-none border-4 border-indigo-100 dark:border-indigo-900/50">
            <QRCodeSVG 
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/app-download?userId=${user?.id}`}
              size={180}
              level="H"
              fgColor="#312e81"
            />
          </div>
          <div className="space-y-4 max-w-sm text-center md:text-left">
            <h3 className="font-bold text-lg text-indigo-900 dark:text-indigo-300">Plug & Play Experience</h3>
            <ul className="text-sm space-y-2 text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-2 justify-center md:justify-start">
                <span className="text-green-500">✓</span> Auto-detects your device (iOS/Android)
              </li>
              <li className="flex items-center gap-2 justify-center md:justify-start">
                <span className="text-green-500">✓</span> Real-time instant notifications
              </li>
              <li className="flex items-center gap-2 justify-center md:justify-start">
                <span className="text-green-500">✓</span> Fully synchronized with this dashboard
              </li>
              <li className="flex items-center gap-2 justify-center md:justify-start">
                <span className="text-green-500">✓</span> Built-in security & virus scanning
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {!loading && <NotificationSettings />}
    </div>
  );
};

export default UserProfile;