import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { FaSpinner, FaSearch, FaUserAltSlash } from 'react-icons/fa';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  position: string | null;
  resignedAt: string | null;
}

const ResignedEmployees: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    fetchResignedUsers();
  }, []);

  const fetchResignedUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users?resignedOnly=true');
      if (!response.ok) {
        throw new Error('Failed to fetch resigned users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching resigned users:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch resigned users',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
    return (
      fullName.includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      (user.position && user.position.toLowerCase().includes(searchLower))
    );
  });

  return (
    <Card className="border-none shadow-md bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent flex items-center">
              <FaUserAltSlash className="mr-3 h-6 w-6 text-red-500" />
              Resigned Employees
            </CardTitle>
            <CardDescription className="text-slate-500 mt-2">
              View all employees who have resigned or have been removed.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by name, email, or position..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <FaSpinner className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow>
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Email</TableHead>
                  <TableHead className="font-semibold">Role</TableHead>
                  <TableHead className="font-semibold">Position</TableHead>
                  <TableHead className="font-semibold text-right">Resigned Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <TableCell className="font-medium">
                        {user.firstName} {user.lastName}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-300">{user.email}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          {user.role}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-300">{user.position || 'N/A'}</TableCell>
                      <TableCell className="text-right text-slate-600 dark:text-slate-300">
                        {user.resignedAt ? new Date(user.resignedAt).toLocaleDateString() : 'Unknown'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                      No resigned employees found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ResignedEmployees;
