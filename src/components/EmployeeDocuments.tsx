import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Download,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Calendar,
  ShieldCheck,
  RefreshCw,
  Clock,
  BookOpen,
  Filter,
  Loader2,
  Building,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import DocumentViewerDialog, { CompanyDocumentItem } from './DocumentViewerDialog';

export default function EmployeeDocuments() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<CompanyDocumentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedDoc, setSelectedDoc] = useState<CompanyDocumentItem | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'ALL') {
        params.append('category', selectedCategory);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const res = await fetch(`/api/company-documents?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch company documents');
      }
      setDocuments(data.documents || []);
    } catch (err: any) {
      toast({
        title: 'Error loading policies',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDocuments();
  };

  const getCategoryTitle = (category: string) => {
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

  const handleDownload = (doc: CompanyDocumentItem) => {
    const link = window.document.createElement('a');
    link.href = doc.fileUrl;
    link.download = doc.fileName || `${doc.title}.pdf`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  // Stats
  const totalPolicies = documents.length;
  const acknowledgedCount = documents.filter((d) => d.userAcknowledgement?.hasAcknowledged).length;
  const pendingCount = documents.filter(
    (d) => d.isRequired && !d.userAcknowledgement?.hasAcknowledged
  ).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-white/10 text-blue-200">
              <BookOpen className="w-6 h-6" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Company Policies & Code of Conduct
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Access official HR Policies (Tsf & Divron), Code of Conduct, and Accommodation rules. Review and acknowledge required documents online.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDocuments}
            className="border-white/20 text-white hover:bg-white/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Employee Policy Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Available Policies
              </p>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {totalPolicies}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Agreed & Acknowledged
              </p>
              <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {acknowledgedCount}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Action Required
              </p>
              <h3
                className={`text-xl font-bold mt-1 ${
                  pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {pendingCount}
              </h3>
            </div>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                pendingCount > 0
                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Filter and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'ALL', label: 'All Documents' },
            { id: 'HR_POLICY', label: 'HR Policy (Tsf & Divron)' },
            { id: 'CODE_OF_CONDUCT', label: 'Code of Conduct' },
            { id: 'ACCOMMODATION_CODE_OF_CONDUCT', label: 'Accommodation Rules' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search policies..."
            className="pl-8 h-8 text-xs"
          />
        </form>
      </div>

      {/* Documents Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-sm text-slate-500">Loading documents...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
          <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No Documents Available
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            No company documents have been published in this category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {documents.map((doc) => {
            const hasAck = doc.userAcknowledgement?.hasAcknowledged;
            return (
              <Card
                key={doc.id}
                className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={getCategoryBadgeClass(doc.category)}>
                        {getCategoryTitle(doc.category)}
                      </Badge>
                      <Badge variant="outline" className="text-[11px] bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {doc.version}
                      </Badge>
                      {doc.companyScope && doc.companyScope !== 'ALL' && (
                        <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300">
                          {doc.companyScope}
                        </Badge>
                      )}
                    </div>

                    {hasAck ? (
                      <Badge className="bg-emerald-600 text-white text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Agreed
                      </Badge>
                    ) : doc.isRequired ? (
                      <Badge className="bg-amber-600 text-white text-[10px] flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        Action Required
                      </Badge>
                    ) : null}
                  </div>

                  <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 mt-2">
                    {doc.title}
                  </CardTitle>
                  {doc.description && (
                    <CardDescription className="text-xs text-slate-500 line-clamp-2 mt-1">
                      {doc.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="p-5 pt-2 space-y-4">
                  {/* Status Box */}
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Effective Date:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {new Date(doc.effectiveDate).toLocaleDateString()}
                      </span>
                    </div>
                    {hasAck && doc.userAcknowledgement?.acknowledgedAt && (
                      <div className="flex items-center justify-between text-emerald-600 font-medium pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                        <span>Acknowledged On:</span>
                        <span>
                          {new Date(doc.userAcknowledgement.acknowledgedAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      variant={hasAck ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => {
                        setSelectedDoc(doc);
                        setIsViewerOpen(true);
                      }}
                      className={`text-xs flex-1 ${
                        !hasAck
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white font-medium'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5" />
                      {hasAck ? 'Review Policy' : 'Read & Acknowledge'}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(doc)}
                      className="text-xs px-3"
                      title="Download PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Embedded Document Viewer */}
      <DocumentViewerDialog
        document={selectedDoc}
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        onAcknowledged={() => fetchDocuments()}
      />
    </div>
  );
}
