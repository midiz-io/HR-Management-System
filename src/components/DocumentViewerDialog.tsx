import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import {
  FileText,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  Layers,
  ShieldCheck,
  Building,
} from 'lucide-react';

export interface CompanyDocumentItem {
  id: string;
  title: string;
  description?: string;
  category: 'HR_POLICY' | 'CODE_OF_CONDUCT' | 'ACCOMMODATION_CODE_OF_CONDUCT' | 'GENERAL' | string;
  customCategory?: string;
  companyScope?: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  version: string;
  versionNotes?: string;
  effectiveDate: string;
  isActive: boolean;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  userAcknowledgement?: {
    hasAcknowledged: boolean;
    hasAcknowledgedPreviousVersion?: boolean;
    acknowledgedVersion?: string | null;
    acknowledgedAt?: string | null;
  };
  stats?: {
    totalEmployees: number;
    acknowledgedCount: number;
    pendingCount: number;
    acknowledgementRate: number;
  };
}

interface DocumentViewerDialogProps {
  document: CompanyDocumentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAcknowledged?: (documentId: string) => void;
}

export default function DocumentViewerDialog({
  document,
  isOpen,
  onClose,
  onAcknowledged,
}: DocumentViewerDialogProps) {
  const { toast } = useToast();
  const [hasAgreed, setHasAgreed] = useState<boolean>(false);
  const [submittingAck, setSubmittingAck] = useState<boolean>(false);

  if (!document) return null;

  const isAcknowledged = document.userAcknowledgement?.hasAcknowledged;
  const isOldVersionAcknowledged = document.userAcknowledgement?.hasAcknowledgedPreviousVersion;

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'HR_POLICY':
        return 'HR Policy (Tsf & Divron)';
      case 'CODE_OF_CONDUCT':
        return 'Code of Conduct';
      case 'ACCOMMODATION_CODE_OF_CONDUCT':
        return 'Accommodation Code of Conduct';
      case 'GENERAL':
        return 'General Policy';
      default:
        return category;
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'HR_POLICY':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200';
      case 'CODE_OF_CONDUCT':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200';
      case 'ACCOMMODATION_CODE_OF_CONDUCT':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200';
    }
  };

  const handleDownload = () => {
    const link = window.document.createElement('a');
    link.href = document.fileUrl;
    link.download = document.fileName || `${document.title}.pdf`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);

    toast({
      title: 'Download Started',
      description: `Downloading ${document.fileName || document.title}`,
    });
  };

  const handleOpenExternal = () => {
    window.open(document.fileUrl, '_blank', 'noopener,noreferrer');
  };

  const handleAcknowledge = async () => {
    if (!hasAgreed) {
      toast({
        title: 'Confirmation Required',
        description: 'Please check the box to confirm that you have read and understood the document.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmittingAck(true);
      const res = await fetch(`/api/company-documents/${document.id}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to acknowledge document');
      }

      toast({
        title: 'Policy Acknowledged',
        description: `You have successfully acknowledged "${document.title}" (${document.version})`,
      });

      if (onAcknowledged) {
        onAcknowledged(document.id);
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to submit acknowledgement',
        variant: 'destructive',
      });
    } finally {
      setSubmittingAck(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[92vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-900/80">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Badge variant="outline" className={getCategoryBadgeClass(document.category)}>
                {getCategoryLabel(document.category)}
              </Badge>
              <Badge variant="outline" className="bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-300">
                <Layers className="w-3 h-3 mr-1" />
                Version {document.version}
              </Badge>
              {document.companyScope && document.companyScope !== 'ALL' && (
                <Badge variant="outline" className="bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300">
                  <Building className="w-3 h-3 mr-1" />
                  {document.companyScope}
                </Badge>
              )}
              {isAcknowledged ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Acknowledged
                </Badge>
              ) : document.isRequired ? (
                <Badge variant="destructive" className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Acknowledgement Required
                </Badge>
              ) : null}
            </div>
            <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              {document.title}
            </DialogTitle>
            {document.description && (
              <DialogDescription className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                {document.description}
              </DialogDescription>
            )}
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenExternal}
              className="text-slate-700 dark:text-slate-300 text-xs sm:text-sm"
              title="Open in new window"
            >
              <ExternalLink className="w-4 h-4 mr-1.5" />
              Open Tab
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleDownload}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm text-xs sm:text-sm"
              title="Download PDF"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Download PDF
            </Button>
          </div>
        </div>

        {/* PDF Viewer Body - Responsive on Desktop and Mobile */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 relative overflow-hidden flex flex-col">
          <object
            data={`${document.fileUrl}#toolbar=1&navpanes=1`}
            type="application/pdf"
            className="w-full h-full border-0"
          >
            <iframe
              src={`${document.fileUrl}#toolbar=1&navpanes=1`}
              className="w-full h-full border-0"
              title={document.title}
            >
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <FileText className="w-16 h-16 text-slate-400 mb-3" />
                <p className="text-slate-700 dark:text-slate-300 font-medium mb-3">
                  Preview is not supported directly in this browser.
                </p>
                <Button onClick={handleOpenExternal} className="bg-indigo-600 text-white">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Document in New Tab
                </Button>
              </div>
            </iframe>
          </object>
        </div>

        {/* Footer with Acknowledgement */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Effective: {new Date(document.effectiveDate).toLocaleDateString()}
            </span>
            {document.versionNotes && (
              <span className="hidden md:inline italic text-slate-400">
                Note: {document.versionNotes}
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {isAcknowledged ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
                Acknowledged on {new Date(document.userAcknowledgement!.acknowledgedAt!).toLocaleDateString()} ({document.userAcknowledgement!.acknowledgedVersion})
              </div>
            ) : document.isRequired ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                {isOldVersionAcknowledged && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    New version updated! Please re-confirm.
                  </span>
                )}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ack-checkbox"
                    checked={hasAgreed}
                    onCheckedChange={(checked) => setHasAgreed(checked as boolean)}
                  />
                  <label
                    htmlFor="ack-checkbox"
                    className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                  >
                    මම මෙම ප්‍රතිපත්තිය කියවා තේරුම්ගත් බව තහවුරු කරමි (I have read and agree)
                  </label>
                </div>
                <Button
                  onClick={handleAcknowledge}
                  disabled={!hasAgreed || submittingAck}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto font-medium"
                  size="sm"
                >
                  {submittingAck ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 mr-1.5" />
                      Confirm & Acknowledge
                    </>
                  )}
                </Button>
              </div>
            ) : null}

            <Button variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
