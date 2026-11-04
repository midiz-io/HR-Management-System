import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Building2,
  Users,
  Search,
  CheckCircle2,
  Building,
  Sparkles,
  ArrowRightLeft,
  Filter,
  ShieldCheck,
  Briefcase,
  Layers,
  UserCheck
} from "lucide-react";
import { motion } from "framer-motion";

export interface CompanyProfile {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  color: string;
  description: string;
}

export interface UserItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position?: string;
  department?: string;
  assignedDepartment?: { name: string } | null;
  role?: string;
}

export const COMPANY_PROFILES: CompanyProfile[] = [
  {
    id: "divron",
    name: "Divron Bioventuress",
    shortName: "Divron Bioventuress",
    logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTyonvZLSZU_YeLDPFlRxLqQ4SkrQhCQbbLRxMXIWy1-XvYZ8r7hyszlDbg&s=10",
    color: "emerald",
    description: "Aquaculture & Bio-venture solutions"
  },
  {
    id: "tropical",
    name: "Tropical ShellFish",
    shortName: "Tropical ShellFish",
    logo: "https://scontent.fcmb1-2.fna.fbcdn.net/v/t39.30808-6/559679736_1297316365426545_2707586598231779437_n.jpg?stp=dst-jpg_tt6&cstp=mx960x960&ctp=s960x960&_nc_cat=108&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=iOhwsMEJjw8Q7kNvwG_xTCw&_nc_oc=AdoqZVirXO1FOi5xTGi1NfMgTRzenC7al3HugM5uEM0EQWUtA9foUlt9_m9Cn3PRtMBI_0vUFeJYP3UbD8fb6bFX&_nc_zt=23&_nc_ht=scontent.fcmb1-2.fna&_nc_gid=CMUtGTscDD0NRLe-TcWVUQ&_nc_ss=7b289&oh=00_AQK8n3I7_fbLl-AJOh5_2Tb5t_6REI1wrJKQVjZTexLMtA&oe=6AAEDC3A",
    color: "blue",
    description: "Premium Shellfish Cultivation & Processing"
  }
];

export default function CompanyCategorization() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [targetCompany, setTargetCompany] = useState<string>("Divron Bioventuress");
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, compRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/companies")
      ]);

      if (usersRes.ok) {
        const userData = await usersRes.json();
        setUsers(userData.users || userData || []);
      }

      if (compRes.ok) {
        const compData = await compRes.json();
        setAssignments(compData.assignments || {});
      }
    } catch (err) {
      console.error("Error fetching data for company categorization:", err);
      toast({
        title: "Error",
        description: "Failed to load employee & company data.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBatchAssign = async (companyNameToAssign?: string) => {
    const comp = companyNameToAssign || targetCompany;
    if (selectedUserIds.length === 0) {
      toast({
        title: "No Employees Selected",
        description: "Please select employees using the checkboxes before batch assigning.",
        variant: "destructive"
      });
      return;
    }

    setIsAssigning(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: selectedUserIds,
          companyName: comp
        })
      });

      if (!res.ok) {
        throw new Error("Failed to update company assignments");
      }

      const data = await res.json();
      setAssignments(data.assignments || {});

      toast({
        title: "Batch Assignment Successful! 🎉",
        description: `Successfully assigned ${selectedUserIds.length} employee(s) to ${comp}.`,
      });

      setSelectedUserIds([]);
    } catch (err: any) {
      console.error("Error in batch assign:", err);
      toast({
        title: "Assignment Failed",
        description: err.message || "Failed to update company assignments.",
        variant: "destructive"
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleInlineAssign = async (userId: string, newCompany: string) => {
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: [userId],
          companyName: newCompany
        })
      });

      if (!res.ok) throw new Error("Failed to assign company");
      const data = await res.json();
      setAssignments(data.assignments || {});

      toast({
        title: "Company Profile Updated",
        description: `Employee reassigned to ${newCompany}.`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Could not update employee company profile.",
        variant: "destructive"
      });
    }
  };

  const departmentsList = Array.from(
    new Set(
      users
        .map((u) => u.assignedDepartment?.name || u.department)
        .filter(Boolean) as string[]
    )
  );

  const filteredUsers = users.filter((u) => {
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
    const email = (u.email || "").toLowerCase();
    const searchLower = searchTerm.toLowerCase();

    const matchesSearch = fullName.includes(searchLower) || email.includes(searchLower);

    const resolvedDept = u.assignedDepartment?.name || u.department || "No Department";
    const matchesDept = deptFilter === "ALL" || resolvedDept === deptFilter;

    const assignedCompany = assignments[u.id] || "UNASSIGNED";
    const matchesCompany =
      companyFilter === "ALL" ||
      (companyFilter === "UNASSIGNED" ? assignedCompany === "UNASSIGNED" : assignedCompany === companyFilter);

    return matchesSearch && matchesDept && matchesCompany;
  });

  const getCompanyCount = (companyName: string) => {
    return Object.values(assignments).filter((c) => c === companyName).length;
  };

  const unassignedCount = users.filter((u) => !assignments[u.id]).length;

  const isAllFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((u) => selectedUserIds.includes(u.id));

  const toggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map((u) => u.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 text-white overflow-hidden shadow-xl border border-slate-700/50">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-400 mb-2">
              <Briefcase className="h-4 w-4" /> Company Profile Categorization
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Company Profiles & Batch Assignment
            </h2>
            <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
              Categorize employees into main company profiles (**Divron Bioventuress** or **Tropical ShellFish**) for payroll processing, reporting, and organizational tracking.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 shrink-0">
            <Users className="h-6 w-6 text-emerald-400" />
            <div>
              <span className="text-xs text-slate-300 font-bold block uppercase tracking-wider">Total Staff</span>
              <span className="text-xl font-black text-white">{users.length} Employees</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Company Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {COMPANY_PROFILES.map((comp) => {
          const count = getCompanyCount(comp.name);
          const isEmerald = comp.color === "emerald";
          return (
            <motion.div
              key={comp.id}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <Card className={`rounded-3xl border-2 transition-all overflow-hidden shadow-lg ${
                companyFilter === comp.name
                  ? "ring-2 ring-primary border-primary"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              }`}>
                <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl p-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-inner shrink-0">
                        <img
                          src={comp.logo}
                          alt={comp.name}
                          className="w-full h-full object-contain rounded-xl"
                          onError={(e) => {
                            // Fallback to building icon if image fails
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                          {comp.name}
                        </CardTitle>
                        <CardDescription className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                          {comp.description}
                        </CardDescription>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                      isEmerald
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                    }`}>
                      {count} {count === 1 ? "Staff" : "Staff"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                    <CheckCircle2 className={`h-4 w-4 ${isEmerald ? "text-emerald-500" : "text-blue-500"}`} />
                    <span>{users.length > 0 ? Math.round((count / users.length) * 100) : 0}% of Total Workforce</span>
                  </div>
                  <Button
                    size="sm"
                    variant={companyFilter === comp.name ? "default" : "outline"}
                    onClick={() => setCompanyFilter(companyFilter === comp.name ? "ALL" : comp.name)}
                    className="rounded-xl text-xs font-bold gap-1.5"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    {companyFilter === comp.name ? "Showing Filtered" : "Filter Staff"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Batch Assignment & Filters Toolbar */}
      <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-md bg-white dark:bg-slate-900">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 flex-wrap">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees by name or email..."
                  className="pl-10 rounded-xl bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Department Filter */}
              <select
                className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <option value="ALL">All Departments</option>
                {departmentsList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              {/* Company Filter */}
              <select
                className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
              >
                <option value="ALL">All Company Profiles</option>
                {COMPANY_PROFILES.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
                <option value="UNASSIGNED">Unassigned ({unassignedCount})</option>
              </select>
            </div>

            {/* Batch Actions Bar */}
            <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800/80 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 flex-wrap shrink-0">
              <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 pl-2">
                Batch Target:
              </span>
              <select
                className="h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                value={targetCompany}
                onChange={(e) => setTargetCompany(e.target.value)}
              >
                {COMPANY_PROFILES.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
                <option value="UNASSIGNED">Remove Assignment</option>
              </select>

              <Button
                disabled={isAssigning || selectedUserIds.length === 0}
                onClick={() => handleBatchAssign()}
                className="rounded-xl font-extrabold text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 flex items-center gap-2"
              >
                <UserCheck className="h-4 w-4" />
                {isAssigning
                  ? "Assigning..."
                  : `Assign Selected (${selectedUserIds.length})`}
              </Button>
            </div>
          </div>

          {/* Quick Select All bar info */}
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-500 font-semibold">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={isAllFilteredSelected}
                onCheckedChange={toggleSelectAll}
                id="select-all-filtered"
              />
              <label htmlFor="select-all-filtered" className="cursor-pointer select-none">
                Select All Filtered ({filteredUsers.length} Employees)
              </label>
            </div>
            <span>
              {selectedUserIds.length} of {filteredUsers.length} selected
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Employee List Table */}
      <Table containerClassName="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-auto max-h-[65vh] relative">
        <TableHeader className="sticky top-0 z-20 shadow-sm">
          <TableRow className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800">
            <TableHead className="w-12 sticky top-0 z-20 bg-slate-100 dark:bg-slate-800">
              <Checkbox
                checked={isAllFilteredSelected}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 font-black uppercase tracking-widest text-[10px]">
              Employee
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 font-black uppercase tracking-widest text-[10px]">
              Department
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 font-black uppercase tracking-widest text-[10px]">
              Position
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 font-black uppercase tracking-widest text-[10px]">
              Assigned Company Profile
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 font-black uppercase tracking-widest text-[10px] text-right">
              Quick Reassign
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-12 text-slate-500 font-bold">
                Loading employee list & company categorization...
              </TableCell>
            </TableRow>
          ) : filteredUsers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-12 text-slate-500 font-bold">
                No employees match the selected search & filter criteria.
              </TableCell>
            </TableRow>
          ) : (
            filteredUsers.map((u) => {
              const assigned = assignments[u.id];
              const compProfile = COMPANY_PROFILES.find((c) => c.name === assigned);
              const isSelected = selectedUserIds.includes(u.id);

              return (
                <TableRow
                  key={u.id}
                  className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                    isSelected ? "bg-emerald-500/5 dark:bg-emerald-950/20" : ""
                  }`}
                >
                  <TableCell className="w-12">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedUserIds([...selectedUserIds, u.id]);
                        } else {
                          setSelectedUserIds(selectedUserIds.filter((id) => id !== u.id));
                        }
                      }}
                    />
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-sm">
                        {(u.firstName || u.email || 'E').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : (u.email || 'Unknown User')}
                        </span>
                        <span className="text-xs text-slate-500">{u.email}</span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                    {u.assignedDepartment?.name || u.department || "N/A"}
                  </TableCell>

                  <TableCell className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                    {u.position || "Staff"}
                  </TableCell>

                  <TableCell>
                    {compProfile ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={compProfile.logo}
                          alt={compProfile.name}
                          className="w-6 h-6 object-contain rounded-md border border-slate-200 dark:border-slate-700"
                        />
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider border ${
                            compProfile.color === "emerald"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                              : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                          }`}
                        >
                          {compProfile.name}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        Unassigned
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <select
                      className="h-8 px-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      value={assigned || "UNASSIGNED"}
                      onChange={(e) => handleInlineAssign(u.id, e.target.value)}
                    >
                      <option value="UNASSIGNED">Unassigned</option>
                      {COMPANY_PROFILES.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
