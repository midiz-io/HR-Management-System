import React, { useState } from 'react';
import { 
  FolderCheck, 
  ExternalLink, 
  ShieldCheck, 
  FileText, 
  Users, 
  Sparkles, 
  Globe, 
  Lock, 
  Copy, 
  Check, 
  Maximize2, 
  ArrowUpRight,
  RefreshCw,
  FolderLock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

const LIVE_PORTAL_URL = 'https://dutch-trails-employee-files.vercel.app/';

interface EmployeePersonalFilesPortalProps {
  userRole?: string;
}

export const EmployeePersonalFilesPortal: React.FC<EmployeePersonalFilesPortalProps> = ({ userRole = 'ADMIN' }) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState<boolean>(false);
  const [showEmbeddedPreview, setShowEmbeddedPreview] = useState<boolean>(false);
  const [iframeKey, setIframeKey] = useState<number>(Date.now());

  const handleOpenExternal = () => {
    window.open(LIVE_PORTAL_URL, '_blank', 'noopener,noreferrer');
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(LIVE_PORTAL_URL);
      setCopied(true);
      toast({
        title: 'URL Copied',
        description: 'Employee Personal Files portal link copied to clipboard.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Copy Failed',
        description: 'Could not copy the link automatically.',
      });
    }
  };

  const handleReloadFrame = () => {
    setIframeKey(Date.now());
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-indigo-900/50"
      >
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 backdrop-blur-md flex items-center gap-1.5 py-1 px-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Vercel System
              </Badge>
              <Badge variant="outline" className="text-slate-300 border-slate-700 bg-slate-800/50 backdrop-blur-md">
                Admin & Super Admin Full Access
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 p-0.5 shadow-lg shadow-indigo-500/20 flex-shrink-0">
                <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                  <FolderLock className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Employee Personal File Management System
                </h1>
                <p className="text-sm text-slate-300 font-medium">
                  Dutch Trails Digital Personnel Records, Identity & Documentation Hub
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed pt-1">
              Centralized platform for comprehensive employee personal dossiers, employment agreements, credentials, identity verifications, and HR compliance files.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <Button
              onClick={handleOpenExternal}
              size="lg"
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold shadow-lg shadow-emerald-500/25 rounded-xl h-12 px-6 flex items-center justify-center gap-2 group transition-all transform hover:scale-[1.02]"
            >
              <span>Open in New Tab</span>
              <ExternalLink className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyUrl}
                className="flex-1 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700 rounded-xl h-9 text-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1.5 text-slate-400" />}
                {copied ? 'Copied Link' : 'Copy Link'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmbeddedPreview(!showEmbeddedPreview)}
                className="flex-1 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700 rounded-xl h-9 text-xs"
              >
                <Maximize2 className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                {showEmbeddedPreview ? 'Hide In-App View' : 'Preview In-App'}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
              <FolderCheck className="w-5 h-5" />
            </div>
            <CardTitle className="text-base font-semibold">Digital Dossiers</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground leading-relaxed">
            Full electronic storage for certificates, resumes, appointment letters, and police reports with instant retrieval.
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <CardTitle className="text-base font-semibold">Admin Privileges</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground leading-relaxed">
            Full read, write, and audit access configured for Admin and Super Admin roles across all company branches.
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
              <Globe className="w-5 h-5" />
            </div>
            <CardTitle className="text-base font-semibold">Vercel Cloud Hosted</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground leading-relaxed">
            Operates on Vercel high-performance edge CDN infrastructure with SSL security and 99.9% uptime.
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
              <Sparkles className="w-5 h-5" />
            </div>
            <CardTitle className="text-base font-semibold">Instant Launch</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground leading-relaxed">
            Seamlessly linked directly from AttendX sidebar and header navigation for smooth workflow switching.
          </CardContent>
        </Card>
      </div>

      {/* Embedded Preview / Direct Launch Section */}
      {showEmbeddedPreview ? (
        <Card className="border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
          <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-3 px-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
              <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
              <span className="w-3 h-3 rounded-full bg-green-400 inline-block" />
              <span className="text-xs font-mono text-muted-foreground ml-2 hidden sm:inline">
                {LIVE_PORTAL_URL}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReloadFrame}
                className="h-8 px-2 text-xs"
                title="Reload Frame"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Reload
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenExternal}
                className="h-8 px-2.5 text-xs font-medium"
              >
                <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                Open Full Window
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 relative bg-slate-900 min-h-[650px] h-[75vh]">
            <iframe
              key={iframeKey}
              src={LIVE_PORTAL_URL}
              title="Employee Personal File Management System"
              className="w-full h-full border-0"
              allow="camera; microphone; geolocation; clipboard-write"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <CardContent className="py-10 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <FolderLock className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-lg font-bold">Ready to manage Employee Files?</h3>
              <p className="text-xs text-muted-foreground">
                Click below to launch the Employee Personal File Management System in a dedicated new tab with full administrative privileges.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                onClick={handleOpenExternal}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl px-6 h-11 flex items-center gap-2 shadow-md shadow-primary/20"
              >
                <span>Launch Personal File System</span>
                <ExternalLink className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowEmbeddedPreview(true)}
                className="rounded-xl px-5 h-11 text-xs"
              >
                <Maximize2 className="w-4 h-4 mr-1.5" />
                Preview Inside AttendX
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EmployeePersonalFilesPortal;
