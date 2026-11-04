import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Loader2,
  Download,
  ExternalLink,
  Layers,
  Building,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { CompanyDocumentItem } from './DocumentViewerDialog';

interface MandatoryPolicyModalProps {
  pendingDocuments: CompanyDocumentItem[];
  isOpen: boolean;
  onAllCompleted: () => void;
}

export default function MandatoryPolicyModal({
  pendingDocuments,
  isOpen,
  onAllCompleted,
}: MandatoryPolicyModalProps) {
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [scrolledToBottom, setScrolledToBottom] = useState<boolean>(false);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [hasAgreed, setHasAgreed] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  const currentDoc = pendingDocuments[currentIndex] || null;
  const totalCount = pendingDocuments.length;

  // Reset scroll & checkbox when document changes
  useEffect(() => {
    setScrolledToBottom(false);
    setScrollProgress(0);
    setHasAgreed(false);

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [currentIndex]);

  // Intersection Observer on the bottom sentinel to detect when user reaches the end
  useEffect(() => {
    if (!isOpen || !currentDoc) return;

    const sentinel = bottomSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setScrolledToBottom(true);
          setScrollProgress(100);
        }
      },
      {
        root: scrollContainerRef.current,
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isOpen, currentDoc, currentIndex]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight <= clientHeight + 20) {
      setScrolledToBottom(true);
      setScrollProgress(100);
      return;
    }

    const progress = Math.min(
      100,
      Math.round(((scrollTop + clientHeight) / scrollHeight) * 100)
    );
    setScrollProgress(progress);

    // If scrolled past 85%, mark as reached bottom
    if (progress >= 85) {
      setScrolledToBottom(true);
    }
  };

  const handleScrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
      setScrolledToBottom(true);
    }
  };

  const handleDownload = () => {
    if (!currentDoc) return;
    const link = window.document.createElement('a');
    link.href = currentDoc.fileUrl;
    link.download = currentDoc.fileName || `${currentDoc.title}.pdf`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  const handleAgreeAndContinue = async () => {
    if (!currentDoc) return;

    if (!scrolledToBottom) {
      toast({
        title: 'Scroll Required',
        description: 'Please scroll to the bottom of the document to review all policies.',
        variant: 'destructive',
      });
      return;
    }

    if (!hasAgreed) {
      toast({
        title: 'Agreement Required',
        description: 'Please check the confirmation box to proceed.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/company-documents/${currentDoc.id}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record acknowledgement');
      }

      toast({
        title: 'Policy Acknowledged',
        description: `Successfully agreed to ${currentDoc.title}`,
      });

      // Check if there are more pending policies
      if (currentIndex + 1 < totalCount) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        // All completed!
        toast({
          title: 'All Required Policies Completed',
          description: 'Welcome to your dashboard!',
        });
        onAllCompleted();
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to submit agreement. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !currentDoc) return null;

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'HR_POLICY':
        return 'HR Policy (Tsf & Divron)';
      case 'CODE_OF_CONDUCT':
        return 'Code of Conduct';
      case 'ACCOMMODATION_CODE_OF_CONDUCT':
        return 'Accommodation Code of Conduct';
      default:
        return 'Company Policy';
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 md:p-6 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-5xl h-[96vh] sm:h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Top Notification Banner */}
        <div className="bg-gradient-to-r from-indigo-700 via-blue-600 to-indigo-800 text-white px-4 py-3 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
                  Mandatory Action Required
                </span>
                <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-white">
                  {currentIndex + 1} of {totalCount}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight">
                Company Policy & Code of Conduct Acknowledgement
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-indigo-100">
            <span>Scroll progress:</span>
            <div className="w-24 h-2 bg-white/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${scrollProgress}%` }}
              />
            </div>
            <span className="font-semibold text-white">{scrollProgress}%</span>
          </div>
        </div>

        {/* Document Header Details */}
        <div className="px-4 py-3 sm:px-6 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs">
                {getCategoryTitle(currentDoc.category)}
              </Badge>
              <Badge variant="outline" className="text-xs border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                <Layers className="w-3 h-3 mr-1" />
                Version {currentDoc.version}
              </Badge>
              {currentDoc.companyScope && currentDoc.companyScope !== 'ALL' && (
                <Badge variant="outline" className="text-xs border-amber-300 text-amber-800 dark:text-amber-300">
                  <Building className="w-3 h-3 mr-1" />
                  {currentDoc.companyScope}
                </Badge>
              )}
            </div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              {currentDoc.title}
            </h1>
            {currentDoc.description && (
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                {currentDoc.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(currentDoc.fileUrl, '_blank')}
              className="text-xs h-8"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              New Tab
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="text-xs h-8"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Download
            </Button>
          </div>
        </div>

        {/* Scrollable Document & PDF Body */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 bg-slate-100 dark:bg-slate-950 relative overflow-y-auto flex flex-col items-center"
        >
          {/* Document Content View */}
          <div className="w-full h-full min-h-[600px] flex flex-col flex-1">
            <object
              data={`${currentDoc.fileUrl}#toolbar=1&navpanes=1`}
              type="application/pdf"
              className="w-full flex-1 min-h-[650px] border-0"
            >
              <iframe
                src={`${currentDoc.fileUrl}#toolbar=1&navpanes=1`}
                className="w-full flex-1 min-h-[650px] border-0"
                title={currentDoc.title}
              >
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <FileText className="w-16 h-16 text-slate-400 mb-3" />
                  <p className="text-slate-700 dark:text-slate-300 font-medium mb-3">
                    PDF preview is ready for viewing.
                  </p>
                  <Button
                    onClick={() => window.open(currentDoc.fileUrl, '_blank')}
                    className="bg-indigo-600 text-white"
                  >
                    Open PDF in Viewer
                  </Button>
                </div>
              </iframe>
            </object>
          </div>

          {/* Bottom Sentinel to reliably detect scrolling to the bottom */}
          <div ref={bottomSentinelRef} className="w-full py-4 text-center bg-slate-200/50 dark:bg-slate-800/50 border-t border-slate-300 dark:border-slate-700">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              --- End of Document: {currentDoc.title} ({currentDoc.version}) ---
            </p>
          </div>

          {/* Quick Floating "Scroll to Bottom" Helper Button */}
          {!scrolledToBottom && (
            <div className="sticky bottom-3 right-3 self-end mr-4">
              <Button
                onClick={handleScrollToBottom}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg text-xs rounded-full px-4 py-2 flex items-center gap-1.5 animate-bounce"
              >
                <span>Scroll to bottom</span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Bottom Gating Bar & Agreement Action */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-3">
          {/* Scroll status helper notification */}
          <div className="flex items-center justify-between text-xs">
            {!scrolledToBottom ? (
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/60 w-full sm:w-auto">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 animate-pulse" />
                <span>
                  Please scroll to the bottom of the document to unlock the "I Agree and Continue" button.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60 w-full sm:w-auto">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>
                  You have reviewed the complete document. Please confirm below to continue.
                </span>
              </div>
            )}

            <div className="hidden sm:block text-slate-400 text-[11px]">
              Effective Date: {new Date(currentDoc.effectiveDate).toLocaleDateString()}
            </div>
          </div>

          {/* Agreement Checkbox & Action Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-start sm:items-center space-x-2.5">
              <Checkbox
                id="policy-agree-checkbox"
                checked={hasAgreed}
                disabled={!scrolledToBottom}
                onCheckedChange={(checked) => setHasAgreed(checked as boolean)}
                className={!scrolledToBottom ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              />
              <label
                htmlFor="policy-agree-checkbox"
                className={`text-xs sm:text-sm font-medium leading-snug select-none ${
                  !scrolledToBottom
                    ? 'text-slate-400 cursor-not-allowed'
                    : 'text-slate-800 dark:text-slate-200 cursor-pointer'
                }`}
              >
                මම මෙම සමාගම් ප්‍රතිපත්තිය සහ චර්යාධර්ම පද්ධතිය සම්පූර්ණයෙන්ම කියවා තේරුම්ගත් බවත්, ඊට එකඟ වන බවත් සහතික කරමි.
                <span className="block text-[11px] text-slate-500 font-normal">
                  (I confirm that I have read, understood, and agree to adhere to this company policy.)
                </span>
              </label>
            </div>

            <Button
              onClick={handleAgreeAndContinue}
              disabled={!scrolledToBottom || !hasAgreed || isSubmitting}
              className={`font-semibold px-6 py-2.5 text-sm rounded-xl transition-all shadow-md flex-shrink-0 ${
                scrolledToBottom && hasAgreed
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Recording Agreement...
                </>
              ) : !scrolledToBottom ? (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Scroll Down to Agree
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {currentIndex + 1 < totalCount ? 'I Agree & Next Policy' : 'I Agree & Continue to Dashboard'}
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
