import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Download,
  Eye,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  Layers,
  Calendar,
  Users,
  ShieldCheck,
  RefreshCw,
  Clock,
  Filter,
  FileCheck,
  Loader2,
  ExternalLink,
  BookOpen,
  ArrowUpRight,
  Info,
  Building,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import DocumentViewerDialog, { CompanyDocumentItem } from './DocumentViewerDialog';

interface EmployeeAckItem {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  isAcknowledged: boolean;
  isOldVersion: boolean;
  acknowledgedVersion: string | null;
  acknowledgedAt: string | null;
  ipAddress: string | null;
}

export default function AdminDocumentManagement() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<CompanyDocumentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);

  // Active items
  const [selectedDoc, setSelectedDoc] = useState<CompanyDocumentItem | null>(null);
  const [docToDelete, setDocToDelete] = useState<CompanyDocumentItem | null>(null);

  // Audit state
  const [auditEmployees, setAuditEmployees] = useState<EmployeeAckItem[]>([]);
  const [auditStats, setAuditStats] = useState<any>(null);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'ACKNOWLEDGED' | 'PENDING'>('ALL');

  // Form state
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('HR_POLICY');
  const [formCompanyScope, setFormCompanyScope] = useState<string>('ALL');
  const [formVersion, setFormVersion] = useState<string>('v1.0');
  const [formVersionNotes, setFormVersionNotes] = useState<string>('');
  const [formEffectiveDate, setFormEffectiveDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [formIsRequired, setFormIsRequired] = useState<boolean>(true);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('includeInactive', 'true');
      if (selectedCategory && selectedCategory !== 'ALL') {
        params.append('category', selectedCategory);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const res = await fetch(`/api/company-documents?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch documents');
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

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormCategory('HR_POLICY');
    setFormCompanyScope('ALL');
    setFormVersion('v1.0');
    setFormVersionNotes('');
    setFormEffectiveDate(new Date().toISOString().split('T')[0]);
    setFormIsRequired(true);
    setFormIsActive(true);
    setSelectedFile(null);
  };

  const openUploadModal = () => {
    resetForm();
    setIsUploadModalOpen(true);
  };

  const openEditModal = (doc: CompanyDocumentItem) => {
    setSelectedDoc(doc);
    setFormTitle(doc.title);
    setFormDescription(doc.description || '');
    setFormCategory(doc.category);
    setFormCompanyScope(doc.companyScope || 'ALL');
    setFormVersion(doc.version);
    setFormVersionNotes(doc.versionNotes || '');
    setFormEffectiveDate(new Date(doc.effectiveDate).toISOString().split('T')[0]);
    setFormIsRequired(doc.isRequired);
    setFormIsActive(doc.isActive);
    setSelectedFile(null);
    setIsEditModalOpen(true);
  };

  const openAuditModal = async (doc: CompanyDocumentItem) => {
    setSelectedDoc(doc);
    setIsAuditModalOpen(true);
    setLoadingAudit(true);
    try {
      const res = await fetch(`/api/company-documents/${doc.id}/acknowledgements`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load audit trail');
      setAuditEmployees(data.employees || []);
      setAuditStats(data.stats || null);
    } catch (err: any) {
      toast({
        title: 'Audit Load Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        toast({
          title: 'Invalid File Format',
          description: 'Only PDF documents (.pdf) are allowed for company policies.',
          variant: 'destructive',
        });
        e.target.value = '';
        return;
      }
      setSelectedFile(file);
      if (!formTitle) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setFormTitle(cleanName);
      }
    }
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast({ title: 'Validation Error', description: 'Please enter a title', variant: 'destructive' });
      return;
    }
    if (!selectedFile) {
      toast({ title: 'Validation Error', description: 'Please upload a PDF file', variant: 'destructive' });
      return;
    }

    try {
      setSubmitting(true);

      // 1. Fast streaming upload using FormData (direct binary transfer, no base64 overhead)
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadRes = await fetch('/api/company-documents/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || 'Failed to upload document file');
      }

      // 2. Create document record
      const docRes = await fetch('/api/company-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          description: formDescription,
          category: formCategory,
          companyScope: formCompanyScope,
          fileUrl: uploadData.fileUrl,
          fileName: uploadData.fileName,
          fileSize: uploadData.fileSize,
          fileType: 'application/pdf',
          version: formVersion,
          versionNotes: formVersionNotes,
          effectiveDate: formEffectiveDate,
          isRequired: formIsRequired,
          isActive: formIsActive,
        }),
      });

      const docData = await docRes.json();
      if (!docRes.ok) {
        throw new Error(docData.error || 'Failed to create document record');
      }

      toast({
        title: 'Document Published',
        description: `"${formTitle}" is now active in the system.`,
      });

      setIsUploadModalOpen(false);
      resetForm();
      fetchDocuments();
    } catch (err: any) {
      toast({
        title: 'Error publishing document',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;

    try {
      setSubmitting(true);
      let fileUrl = selectedDoc.fileUrl;
      let fileName = selectedDoc.fileName;
      let fileSize = selectedDoc.fileSize;

      // If a new PDF was selected to update
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const uploadRes = await fetch('/api/company-documents/upload', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || 'Failed to upload revised document');
        }
        fileUrl = uploadData.fileUrl;
        fileName = uploadData.fileName;
        fileSize = uploadData.fileSize;
      }

      const res = await fetch(`/api/company-documents/${selectedDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          description: formDescription,
          category: formCategory,
          companyScope: formCompanyScope,
          fileUrl,
          fileName,
          fileSize,
          fileType: 'application/pdf',
          version: formVersion,
          versionNotes: formVersionNotes,
          effectiveDate: formEffectiveDate,
          isRequired: formIsRequired,
          isActive: formIsActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update document');

      toast({
        title: 'Document Updated',
        description: `Successfully updated "${formTitle}"`,
      });

      setIsEditModalOpen(false);
      fetchDocuments();
    } catch (err: any) {
      toast({
        title: 'Update Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (doc: CompanyDocumentItem) => {
    try {
      const res = await fetch(`/api/company-documents/${doc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !doc.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update status');

      toast({
        title: !doc.isActive ? 'Policy Activated' : 'Policy Deactivated',
        description: `Document is now ${!doc.isActive ? 'Active' : 'Inactive'}`,
      });

      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, isActive: !doc.isActive } : d))
      );
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteDocument = async () => {
    if (!docToDelete) return;
    try {
      const res = await fetch(`/api/company-documents/${docToDelete.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete document');

      toast({
        title: 'Document Deleted',
        description: `"${docToDelete.title}" has been removed.`,
      });

      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      setIsDeleteDialogOpen(false);
      setDocToDelete(null);
    } catch (err: any) {
      toast({
        title: 'Delete Failed',
        description: err.message,
        variant: 'destructive',
      });
    }
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

  // Overall statistics
  const totalDocs = documents.length;
  const activeDocs = documents.filter((d) => d.isActive).length;
  const totalEmployees = documents[0]?.stats?.totalEmployees || 0;
  const averageCompliance = totalDocs > 0
    ? Math.round(
        documents.reduce((acc, d) => acc + (d.stats?.acknowledgementRate || 0), 0) / totalDocs
      )
    : 0;

  // Filter audit employees
  const filteredAuditEmployees = auditEmployees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(auditSearch.toLowerCase()) ||
      emp.email.toLowerCase().includes(auditSearch.toLowerCase()) ||
      emp.department.toLowerCase().includes(auditSearch.toLowerCase());

    if (!matchesSearch) return false;
    if (auditFilter === 'ACKNOWLEDGED') return emp.isAcknowledged;
    if (auditFilter === 'PENDING') return !emp.isAcknowledged;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300">
              <BookOpen className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Company Policies & Documents</h1>
          </div>
          <p className="text-sm text-slate-300 max-w-xl">
            Upload and manage HR Policies (Tsf & Divron), Code of Conduct, and Accommodation Rules. Employees are gated to review and agree to mandatory policies upon login.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDocuments}
            className="border-slate-700 hover:bg-slate-800 text-slate-200"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            onClick={openUploadModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/30 font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Upload PDF Document
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Documents
              </p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {totalDocs}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Across all categories</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Active Policies
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {activeDocs}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Currently enforced</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Employees
              </p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {totalEmployees}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Target employee pool</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Avg. Compliance
              </p>
              <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                {averageCompliance}%
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Signed & agreed</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'ALL', label: 'All Categories' },
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

        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="relative sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search document title..."
            className="pl-9 h-9 text-xs"
          />
        </form>
      </div>

      {/* Documents Grid / List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-sm text-slate-500">Loading company policies...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            No Documents Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-4">
            No policies uploaded in this category yet. Click below to upload your HR Policy, Code of Conduct, or Accommodation rules PDF.
          </p>
          <Button onClick={openUploadModal} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Upload PDF Document
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {documents.map((doc) => (
            <Card
              key={doc.id}
              className={`border transition-all hover:shadow-md ${
                doc.isActive
                  ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  : 'border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/40 opacity-80'
              }`}
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

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={doc.isActive}
                      onCheckedChange={() => handleToggleStatus(doc)}
                      title={doc.isActive ? 'Deactivate policy' : 'Activate policy'}
                    />
                  </div>
                </div>

                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 mt-2 line-clamp-1">
                  {doc.title}
                </CardTitle>
                {doc.description && (
                  <CardDescription className="text-xs text-slate-500 line-clamp-2 mt-1">
                    {doc.description}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="p-5 pt-2 space-y-4">
                {/* File Details */}
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate max-w-[200px] font-medium text-slate-700 dark:text-slate-300">
                      📄 {doc.fileName}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : 'PDF'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>Effective: {new Date(doc.effectiveDate).toLocaleDateString()}</span>
                    <span>{doc.isRequired ? 'Mandatory' : 'Optional'}</span>
                  </div>
                </div>

                {/* Compliance Progress Bar */}
                {doc.stats && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-600 dark:text-slate-400">Employee Compliance</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                        {doc.stats.acknowledgedCount} / {doc.stats.totalEmployees} ({doc.stats.acknowledgementRate}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                        style={{ width: `${doc.stats.acknowledgementRate}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedDoc(doc);
                        setIsViewerOpen(true);
                      }}
                      className="h-8 text-xs text-slate-700 dark:text-slate-300"
                      title="Preview PDF"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      View
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAuditModal(doc)}
                      className="h-8 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900 hover:bg-indigo-50"
                      title="View acknowledgements audit"
                    >
                      <Users className="w-3.5 h-3.5 mr-1" />
                      Audit
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(doc)}
                      className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      title="Edit policy details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDocToDelete(doc);
                        setIsDeleteDialogOpen(true);
                      }}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                      title="Delete policy"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-indigo-600" />
              Upload Company Policy / Document
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Upload PDF documents for HR Policies (Tsf & Divron), Code of Conduct, or Accommodation rules.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateDocument} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold">Policy Title *</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Employee HR Policy 2026 (Tsf & Divron)"
                className="mt-1"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Category *</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HR_POLICY">HR Policy (Tsf & Divron)</SelectItem>
                    <SelectItem value="CODE_OF_CONDUCT">Code of Conduct</SelectItem>
                    <SelectItem value="ACCOMMODATION_CODE_OF_CONDUCT">Accommodation Code of Conduct</SelectItem>
                    <SelectItem value="GENERAL">General Policy / Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Target Company Scope</Label>
                <Select value={formCompanyScope} onValueChange={setFormCompanyScope}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select Scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Companies / Common (Tsf & Divron)</SelectItem>
                    <SelectItem value="Tropical ShellFish">Tropical ShellFish (Tsf)</SelectItem>
                    <SelectItem value="Divron Bioventuress">Divron Bioventuress (Divron)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Version</Label>
                <Input
                  value={formVersion}
                  onChange={(e) => setFormVersion(e.target.value)}
                  placeholder="v1.0"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Effective Date</Label>
                <Input
                  type="date"
                  value={formEffectiveDate}
                  onChange={(e) => setFormEffectiveDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Description / Scope</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief summary of what this document covers..."
                className="mt-1 resize-none h-16 text-xs"
              />
            </div>

            {/* Strict PDF File Dropzone */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">PDF Document File (.pdf only) *</Label>
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/50">
                <input
                  type="file"
                  id="pdf-upload-input"
                  accept="application/pdf,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="pdf-upload-input" className="cursor-pointer block">
                  <FileText className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                  {selectedFile ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {Math.round(selectedFile.size / 1024)} KB - Click to replace
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Click to select PDF document
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Only PDF format is accepted (.pdf)
                      </p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Require Mandatory Acknowledgement
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Employees must scroll down and agree upon login before entering dashboard
                  </p>
                </div>
                <Switch checked={formIsRequired} onCheckedChange={setFormIsRequired} />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Publish Immediately (Active)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Make visible and enforce for employees right away
                  </p>
                </div>
                <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUploadModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading PDF...
                  </>
                ) : (
                  'Publish Document'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Edit Company Policy</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Update metadata, version, or replace the attached PDF file.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateDocument} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold">Policy Title *</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Category *</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HR_POLICY">HR Policy (Tsf & Divron)</SelectItem>
                    <SelectItem value="CODE_OF_CONDUCT">Code of Conduct</SelectItem>
                    <SelectItem value="ACCOMMODATION_CODE_OF_CONDUCT">Accommodation Code of Conduct</SelectItem>
                    <SelectItem value="GENERAL">General Policy / Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Target Company Scope</Label>
                <Select value={formCompanyScope} onValueChange={setFormCompanyScope}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Companies / Common (Tsf & Divron)</SelectItem>
                    <SelectItem value="Tropical ShellFish">Tropical ShellFish (Tsf)</SelectItem>
                    <SelectItem value="Divron Bioventuress">Divron Bioventuress (Divron)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Version</Label>
                <Input
                  value={formVersion}
                  onChange={(e) => setFormVersion(e.target.value)}
                  placeholder="v1.1"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Effective Date</Label>
                <Input
                  type="date"
                  value={formEffectiveDate}
                  onChange={(e) => setFormEffectiveDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Version Notes</Label>
              <Input
                value={formVersionNotes}
                onChange={(e) => setFormVersionNotes(e.target.value)}
                placeholder="e.g. Updated accommodation guidelines section 4"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="mt-1 resize-none h-16 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Replace PDF File (Optional)</Label>
              <Input
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileChange}
                className="mt-1 text-xs"
              />
              {selectedDoc && !selectedFile && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Current file: {selectedDoc.fileName}
                </p>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Mandatory Acknowledgement
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Require employees to agree before dashboard access
                  </p>
                </div>
                <Switch checked={formIsRequired} onCheckedChange={setFormIsRequired} />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Active Status
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Allow employees to view and acknowledge
                  </p>
                </div>
                <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {submitting ? 'Saving Changes...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Audit Modal */}
      <Dialog open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-0">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge className="bg-indigo-600 text-white text-xs mb-1">
                  Audit Trail
                </Badge>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {selectedDoc?.title} ({selectedDoc?.version})
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  View which employees have read and agreed to this document, timestamps, and IP addresses.
                </DialogDescription>
              </div>

              {auditStats && (
                <div className="text-right">
                  <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                    {auditStats.rate}%
                  </span>
                  <p className="text-[11px] text-slate-400">
                    {auditStats.acknowledgedCount} of {auditStats.totalEmployees} Agreed
                  </p>
                </div>
              )}
            </div>

            {/* Audit Filter & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mt-4">
              <div className="flex items-center gap-1.5">
                {(['ALL', 'ACKNOWLEDGED', 'PENDING'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setAuditFilter(filter)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                      auditFilter === filter
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {filter === 'ALL' ? 'All Employees' : filter === 'ACKNOWLEDGED' ? 'Agreed' : 'Pending'}
                  </button>
                ))}
              </div>

              <div className="relative sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Filter employee..."
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Audit Table */}
          <div className="flex-1 overflow-y-auto p-4">
            {loadingAudit ? (
              <div className="flex flex-col items-center justify-center p-12 space-y-2">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                <p className="text-xs text-slate-500">Loading audit records...</p>
              </div>
            ) : filteredAuditEmployees.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">
                No matching employee records found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-2.5 rounded-l-lg">Employee</th>
                      <th className="p-2.5">Department</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Version</th>
                      <th className="p-2.5">Date & Time</th>
                      <th className="p-2.5 rounded-r-lg">IP / Device</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredAuditEmployees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">
                          <div>{emp.name}</div>
                          <div className="text-[10px] text-slate-400">{emp.email}</div>
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400">
                          {emp.department}
                        </td>
                        <td className="p-2.5">
                          {emp.isAcknowledged ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 text-[10px]">
                              Agreed
                            </Badge>
                          ) : emp.isOldVersion ? (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 text-[10px]">
                              Old Version
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-400 border-slate-300 text-[10px]">
                              Pending
                            </Badge>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-500">
                          {emp.acknowledgedVersion || '-'}
                        </td>
                        <td className="p-2.5 text-slate-500">
                          {emp.acknowledgedAt
                            ? new Date(emp.acknowledgedAt).toLocaleString()
                            : '-'}
                        </td>
                        <td className="p-2.5 text-slate-400 font-mono text-[10px]">
                          {emp.ipAddress || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setIsAuditModalOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-600">
              Delete Company Policy?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to delete "{docToDelete?.title}"? All associated employee acknowledgements will also be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDocument}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
