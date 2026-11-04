import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { FaDatabase, FaDownload, FaInfoCircle, FaCheckCircle, FaExclamationTriangle, FaFileCode, FaFileAlt } from 'react-icons/fa';

const DatabaseBackup: React.FC = () => {
  const [isDownloadingJSON, setIsDownloadingJSON] = useState(false);
  const [isDownloadingSQL, setIsDownloadingSQL] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [lastBackupType, setLastBackupType] = useState<string | null>(null);
  const { toast } = useToast();

  const downloadJSONBackup = async () => {
    setIsDownloadingJSON(true);
    try {
      const response = await fetch('/api/admin/database-backup');
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create backup');
      }

      const backup = await response.json();
      
      // Create blob and download
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from response or create one
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      link.download = `database_backup_${timestamp}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setLastBackup(new Date().toLocaleString());
      setLastBackupType('JSON');
      
      // Calculate total records
      const totalRecords = backup.metadata?.recordCounts 
        ? Object.values(backup.metadata.recordCounts).reduce((a, b) => (a as number) + (b as number), 0)
        : 0;
      
      toast({
        title: 'JSON Backup Successful',
        description: `Database backup downloaded successfully. Total records: ${totalRecords}`,
      });
    } catch (error) {
      console.error('JSON Backup error:', error);
      toast({
        title: 'Backup Failed',
        description: error instanceof Error ? error.message : 'Failed to create database backup',
        variant: 'destructive',
      });
    } finally {
      setIsDownloadingJSON(false);
    }
  };

  const downloadSQLBackup = async () => {
    setIsDownloadingSQL(true);
    try {
      const response = await fetch('/api/admin/database-backup-sql');
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create SQL backup');
      }

      const sqlContent = await response.text();
      
      // Create blob and download
      const blob = new Blob([sqlContent], { type: 'application/sql' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      link.download = `database_backup_${timestamp}.sql`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setLastBackup(new Date().toLocaleString());
      setLastBackupType('SQL');
      
      // Count INSERT statements to estimate records
      const insertCount = (sqlContent.match(/INSERT INTO/g) || []).length;
      
      toast({
        title: 'SQL Backup Successful',
        description: `SQL backup downloaded successfully. Approximately ${insertCount} records exported.`,
      });
    } catch (error) {
      console.error('SQL Backup error:', error);
      toast({
        title: 'Backup Failed',
        description: error instanceof Error ? error.message : 'Failed to create SQL backup',
        variant: 'destructive',
      });
    } finally {
      setIsDownloadingSQL(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Database Backup</h2>
        <p className="text-muted-foreground">
          Create and download a complete backup of your database
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FaDatabase className="h-5 w-5" />
            Full Database Backup
          </CardTitle>
          <CardDescription>
            Download a complete backup of all database tables and records in JSON or SQL format
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <FaInfoCircle className="h-4 w-4" />
            <AlertDescription>
              This backup includes all data from the following tables:
              <ul className="mt-2 ml-4 list-disc text-sm space-y-1">
                <li>Users (with all relations)</li>
                <li>Locations</li>
                <li>Attendances</li>
                <li>Work Shifts & Rosters</li>
                <li>Leave Types, Requests & Balances</li>
                <li>Tasks & Task Messages</li>
                <li>Notifications</li>
              </ul>
            </AlertDescription>
          </Alert>

          {lastBackup && (
            <Alert className="bg-green-50 border-green-200">
              <FaCheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Last backup created: <strong>{lastBackup}</strong> ({lastBackupType} format)
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold mb-2">Choose Backup Format:</h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={downloadJSONBackup}
                  disabled={isDownloadingJSON || isDownloadingSQL}
                  size="lg"
                  className="flex items-center gap-2 flex-1"
                  variant="default"
                >
                  <FaFileCode className="h-4 w-4" />
                  {isDownloadingJSON ? 'Creating JSON Backup...' : 'Download JSON Backup'}
                </Button>
                
                <Button
                  onClick={downloadSQLBackup}
                  disabled={isDownloadingJSON || isDownloadingSQL}
                  size="lg"
                  className="flex items-center gap-2 flex-1"
                  variant="secondary"
                >
                  <FaFileAlt className="h-4 w-4" />
                  {isDownloadingSQL ? 'Creating SQL Backup...' : 'Download SQL Backup'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FaFileCode className="h-4 w-4 text-blue-600" />
                  <h5 className="font-semibold text-sm">JSON Format</h5>
                </div>
                <ul className="ml-6 text-xs text-muted-foreground space-y-1">
                  <li>• Structured data with metadata</li>
                  <li>• Includes all relations and nested data</li>
                  <li>• Easy to parse and analyze</li>
                  <li>• Best for data migration and inspection</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FaFileAlt className="h-4 w-4 text-green-600" />
                  <h5 className="font-semibold text-sm">SQL Format</h5>
                </div>
                <ul className="ml-6 text-xs text-muted-foreground space-y-1">
                  <li>• Ready-to-execute SQL statements</li>
                  <li>• Direct database restore capability</li>
                  <li>• PostgreSQL compatible</li>
                  <li>• Best for database recovery</li>
                </ul>
              </div>
            </div>
          </div>

          <Alert variant="destructive" className="bg-orange-50 border-orange-200">
            <FaExclamationTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>Important Notes:</strong>
              <ul className="mt-2 ml-4 list-disc text-sm space-y-1">
                <li>Backup files may be large depending on your data volume</li>
                <li>Store backup files securely as they contain sensitive information</li>
                <li>Regular backups are recommended (weekly or monthly)</li>
                <li>Test restore procedures periodically to ensure data integrity</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup Information</CardTitle>
          <CardDescription>
            What's included in the backup file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-semibold">User Data:</h4>
              <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                <li>User profiles and roles</li>
                <li>Authentication information</li>
                <li>Department assignments</li>
                <li>User preferences</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Attendance Data:</h4>
              <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                <li>Check-in/Check-out records</li>
                <li>Location data</li>
                <li>Status information</li>
                <li>Timestamps and notes</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Leave Management:</h4>
              <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                <li>Leave types and balances</li>
                <li>Leave requests</li>
                <li>Approval history</li>
                <li>Supporting documents</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Work Schedules:</h4>
              <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                <li>Work shift definitions</li>
                <li>Roster assignments</li>
                <li>Schedule history</li>
                <li>Employee assignments</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Tasks:</h4>
              <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                <li>Task assignments</li>
                <li>Task messages</li>
                <li>Status updates</li>
                <li>Proof submissions</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">System Data:</h4>
              <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                <li>Notifications</li>
                <li>System configurations</li>
                <li>Metadata information</li>
                <li>Timestamps</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup Best Practices</CardTitle>
          <CardDescription>
            Recommendations for managing your backups
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <FaCheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Regular Schedule:</strong> Create backups weekly or after major data changes
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FaCheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Secure Storage:</strong> Keep backups in a secure, encrypted location
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FaCheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Multiple Copies:</strong> Maintain at least 3 backup copies in different locations
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FaCheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Version Control:</strong> Keep dated backup files for historical reference
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FaCheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Test Restores:</strong> Periodically verify backup integrity by testing restore procedures
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FaCheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Access Control:</strong> Limit backup access to authorized administrators only
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabaseBackup;
