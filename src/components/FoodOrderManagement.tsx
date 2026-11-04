import React, { useState, useEffect } from "react";
import { format, startOfToday, addDays, isSameDay } from "date-fns";
import { 
  Utensils, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Calendar as CalendarIcon,
  Plus,
  Search,
  Filter,
  Check,
  X,
  AlertCircle,
  ChevronRight,
  Loader2,
  MapPin,
  Building,
  Share2,
  Coffee,
  Sun,
  Moon,
  CalendarDays,
  Trash2
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

interface FoodOrder {
  id: string;
  userId: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    department: string;
  };
  date: string;
  mealType: string;
  location?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  notes?: string;
  approvedBy?: {
    firstName: string;
    lastName: string;
  };
  approvedAt?: string;
  createdAt: string;
}

const MEAL_TYPES = [
  { id: 'Breakfast', label: 'Breakfast', time: '08:00 - 09:00' },
  { id: 'Lunch', label: 'Lunch', time: '12:00 - 14:00' },
  { id: 'Dinner', label: 'Dinner', time: '19:00 - 21:00' },
  { id: 'Breakfast + Lunch', label: 'Breakfast + Lunch', time: 'Full Day (Day Shift)' },
  { id: 'Lunch + Dinner', label: 'Lunch + Dinner', time: 'Afternoon/Evening' },
  { id: 'Full Meals', label: 'Breakfast + Lunch + Dinner', time: '24h Stay' },
];

const SHIFTS_MEALS = [
  { label: '8:30 - 5:30', meals: 'Breakfast + Lunch' },
  { label: '10:00 - 7:00', meals: 'Lunch only' },
  { label: '7:30 - 4:30', meals: 'Breakfast + Lunch' },
  { label: '1:00 - 10:00', meals: 'Lunch + Dinner' },
  { label: '2:00 - 11:00', meals: 'Dinner only' },
];

const LOCATIONS = [
  "live center",
  "packing center",
  "divron office",
  "dutch trails",
  "barly",
  "cooperate office"
];

export default function FoodOrderManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [selectedMeal, setSelectedMeal] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      if (user) {
        try {
          const res = await fetch('/api/user', {
            headers: { 'Authorization': user.id }
          });
          if (res.ok) {
            const data = await res.json();
            setIsAdmin(data.role === 'ADMIN' || data.role === 'SUPER_ADMIN' || data.role === 'MANAGER');
          }
        } catch (err) {
          console.error(err);
        }
      }
    };
    checkRole();
  }, [user]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/food');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch food orders.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeal || !selectedLocation) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select both a meal type and a location.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealType: selectedMeal,
          location: selectedLocation,
          date: selectedDate.toISOString(),
          notes,
        }),
      });

      if (res.ok) {
        toast({
          title: "Order Placed",
          description: `Your ${selectedMeal} order has been submitted for approval.`,
        });
        setIsDialogOpen(false);
        fetchOrders();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to create order");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch('/api/food', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status }),
      });

      if (res.ok) {
        toast({
          title: `Order ${status}`,
          description: `The food order has been ${status.toLowerCase()}.`,
        });
        fetchOrders();
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update order status.",
      });
    }
  };

  const handleBulkUpdate = async (newStatus: string) => {
    // Only process the selected orders that are currently PENDING
    const pendingSelectedIds = orders
      .filter(o => selectedOrderIds.includes(o.id) && o.status === 'PENDING')
      .map(o => o.id);

    if (pendingSelectedIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No Pending Orders",
        description: "None of the selected orders can be updated (must be PENDING).",
      });
      return;
    }
    
    setIsBulkUpdating(true);
    try {
      const res = await fetch('/api/food', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: pendingSelectedIds, status: newStatus }),
      });

      if (res.ok) {
        toast({
          title: `Bulk ${status}`,
          description: `${selectedOrderIds.length} orders have been ${status.toLowerCase()}.`,
        });
        setSelectedOrderIds([]);
        fetchOrders();
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update orders.",
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedOrderIds.length === 0) return;
    
    setIsBulkUpdating(true);
    try {
      const res = await fetch('/api/food', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedOrderIds }),
      });

      if (res.ok) {
        toast({
          title: "Orders Deleted",
          description: `${selectedOrderIds.length} orders have been permanently cleared.`,
        });
        setSelectedOrderIds([]);
        fetchOrders();
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete orders.",
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleShareWhatsApp = () => {
    const today = startOfToday();
    const approvedToday = orders.filter(o => isSameDay(new Date(o.date), today) && o.status === 'APPROVED');
    
    let message = `*🍱 DAILY FOOD ORDER SUMMARY*\n`;
    message += `📅 *Date:* ${format(today, 'yyyy-MM-dd')}\n\n`;
    
    message += `📍 *LOCATION WISE:*\n`;
    LOCATIONS.forEach(loc => {
      const count = approvedToday.filter(o => o.location === loc).length;
      if (count > 0) message += `- ${loc.toUpperCase()}: *${count}*\n`;
    });
    
    message += `\n🍽️ *MEAL TYPE WISE:*\n`;
    MEAL_TYPES.forEach(meal => {
      const count = approvedToday.filter(o => o.mealType === meal.id).length;
      if (count > 0) message += `- ${meal.label}: *${count}*\n`;
    });
    
    message += `\n✅ *TOTAL APPROVED:* *${approvedToday.length}*`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const filteredOrders = orders.filter(order => {
    const matchesStatus = filterStatus === "ALL" || order.status === filterStatus;
    const matchesSearch = 
      order.user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.mealType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const locationCounts = LOCATIONS.reduce((acc, loc) => {
    acc[loc] = orders.filter(o => 
      isSameDay(new Date(o.date), startOfToday()) && 
      o.location === loc && 
      o.status === 'APPROVED'
    ).length;
    return acc;
  }, {} as Record<string, number>);

  const mealCounts = MEAL_TYPES.reduce((acc, meal) => {
    acc[meal.id] = orders.filter(o => 
      isSameDay(new Date(o.date), startOfToday()) && 
      o.mealType === meal.id && 
      o.status === 'APPROVED'
    ).length;
    return acc;
  }, {} as Record<string, number>);

  const getMealIcon = (mealId: string) => {
    if (mealId.includes('Breakfast')) return <Coffee className="w-4 h-4 text-orange-500" />;
    if (mealId.includes('Lunch')) return <Sun className="w-4 h-4 text-amber-500" />;
    if (mealId.includes('Dinner')) return <Moon className="w-4 h-4 text-indigo-500" />;
    return <Utensils className="w-4 h-4 text-primary" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">Pending</Badge>;
      case 'APPROVED': return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">Approved</Badge>;
      case 'REJECTED': return <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200">Rejected</Badge>;
      case 'CANCELLED': return <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Food Ordering System</h1>
          <p className="text-muted-foreground">Manage and request meals for your work shifts.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-lg shadow-primary/20 gap-2">
              <Plus className="w-4 h-4" />
              Request New Meal
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Request Meal</DialogTitle>
              <DialogDescription>
                Place an order for a meal. Orders require administrative approval.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateOrder} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Date</Label>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {[0, 1, 2, 3, 4].map(day => {
                    const date = addDays(startOfToday(), day);
                    const isSelected = isSameDay(date, selectedDate);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSelectedDate(date)}
                        className={`flex flex-col items-center justify-center min-w-[64px] p-2 rounded-xl border transition-all ${
                          isSelected 
                            ? 'bg-primary text-primary-foreground border-primary shadow-md' 
                            : 'bg-white hover:border-primary/50 text-slate-600'
                        }`}
                      >
                        <span className="text-[10px] uppercase font-bold">{format(date, 'EEE')}</span>
                        <span className="text-lg font-bold">{format(date, 'd')}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Meal Type</Label>
                <Select value={selectedMeal} onValueChange={setSelectedMeal}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select meal type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {MEAL_TYPES.map(meal => (
                      <SelectItem key={meal.id} value={meal.id} className="rounded-lg">
                        <div className="flex flex-col">
                          <span className="font-medium">{meal.label}</span>
                          <span className="text-xs text-muted-foreground">{meal.time}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Select Location</Label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select your location" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {LOCATIONS.map(loc => (
                      <SelectItem key={loc} value={loc} className="rounded-lg capitalize">
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 pt-2">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />
                  <div className="text-xs text-blue-700 leading-snug">
                    <p className="font-bold mb-1">Standard Meal Hours:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>Breakfast: 08:00 - 09:00</li>
                      <li>Lunch: 12:00 - 14:00</li>
                      <li>Dinner: 19:00 - 21:00</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input 
                  id="notes" 
                  placeholder="E.g. Dietary requirements..." 
                  className="rounded-xl"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <DialogFooter>
                <Button 
                  type="submit" 
                  className="w-full rounded-xl" 
                  disabled={isSubmitting || !selectedMeal || !selectedLocation}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Submit Request
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Statistics Cards */}
        <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-emerald-100 font-medium">Approved Today</CardDescription>
            <CardTitle className="text-3xl font-black">
              {orders.filter(o => isSameDay(new Date(o.date), startOfToday()) && o.status === 'APPROVED').length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-100">
              <Utensils className="w-3 h-3" />
              <span>Meals ready for pickup</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-amber-400 to-orange-500 text-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-amber-50 font-medium">Pending Requests</CardDescription>
            <CardTitle className="text-3xl font-black">
              {orders.filter(o => o.status === 'PENDING').length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs font-medium text-amber-50">
              <Clock className="w-3 h-3" />
              <span>Awaiting administrative review</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardDescription className="font-medium">Meal Packages</CardDescription>
            <CardTitle className="text-lg font-bold">Shift-Based Suggestion</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-6 pb-4 space-y-2">
              {SHIFTS_MEALS.slice(0, 3).map((shift, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0">
                  <span className="font-bold text-slate-500">{shift.label}</span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full font-medium">{shift.meals}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <>
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Building className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold tracking-tight">Location-wise Daily Summary (Approved)</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {LOCATIONS.map((loc) => (
                <motion.div
                  key={loc}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -5 }}
                  className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center gap-2 group transition-all hover:shadow-md hover:border-primary/20"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <MapPin className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{locationCounts[loc] || 0}</div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest truncate w-full px-1 capitalize">
                      {loc}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold tracking-tight">Meal-wise Daily Summary (Approved)</h2>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl gap-2 text-emerald-600 border-emerald-100 hover:bg-emerald-50"
                onClick={handleShareWhatsApp}
              >
                <Share2 className="w-4 h-4" />
                Share Report
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {MEAL_TYPES.map((meal) => (
                <motion.div
                  key={meal.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -5 }}
                  className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center gap-2 group transition-all hover:shadow-md hover:border-primary/20"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    {getMealIcon(meal.id)}
                  </div>
                  <div>
                    <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{mealCounts[meal.id] || 0}</div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest truncate w-full px-1">
                      {meal.label}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}

      <Card className="rounded-2xl shadow-sm border-slate-100 dark:border-slate-800 overflow-hidden">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Track and manage food requests.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && selectedOrderIds.length > 0 && (
                <div className="flex items-center gap-2 pr-2 mr-2 border-r border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500">{selectedOrderIds.length} Selected</span>
                  <Button 
                    size="sm" 
                    className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700"
                    disabled={isBulkUpdating}
                    onClick={() => handleBulkUpdate('APPROVED')}
                  >
                    Approve All
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    className="h-8 rounded-lg"
                    disabled={isBulkUpdating}
                    onClick={() => handleBulkUpdate('REJECTED')}
                  >
                    Reject All
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 font-bold text-[10px] uppercase tracking-wider"
                        disabled={isBulkUpdating}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Clear Selected
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl border-t-4 border-red-600">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Permanent Deletion</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to permanently clear {selectedOrderIds.length} selected orders? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleBulkDelete}
                          className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
                        >
                          Delete Permanently
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Search user or meal..." 
                  className="pl-10 h-9 w-[200px] md:w-[250px] rounded-xl border-slate-200 dark:border-slate-800"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 w-[130px] rounded-xl border-slate-200 dark:border-slate-800">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/30 dark:bg-slate-900/30 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-slate-100 dark:border-slate-800">
                  {isAdmin && (
                    <th className="px-6 py-4 w-10">
                      {(() => {
                        const allSelected = filteredOrders.length > 0 && filteredOrders.every(o => selectedOrderIds.includes(o.id));
                        const someSelected = filteredOrders.some(o => selectedOrderIds.includes(o.id)) && !allSelected;
                        
                        return (
                          <Checkbox 
                            checked={allSelected ? true : someSelected ? "indeterminate" : false}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                const allIds = filteredOrders.map(o => o.id);
                                setSelectedOrderIds(prev => Array.from(new Set([...prev, ...allIds])));
                              } else {
                                const visibleIds = filteredOrders.map(o => o.id);
                                setSelectedOrderIds(prev => prev.filter(id => !visibleIds.includes(id)));
                              }
                            }}
                          />
                        );
                      })()}
                    </th>
                  )}
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Meal & Date</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Notes</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <AnimatePresence mode="popLayout">
                  {loading ? (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
                          <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading orders...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Utensils className="w-10 h-10 text-slate-200" />
                          <p className="text-sm font-medium text-slate-400">No orders found.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <motion.tr 
                        key={order.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${selectedOrderIds.includes(order.id) ? 'bg-primary/5' : ''}`}
                      >
                        {isAdmin && (
                          <td className="px-6 py-4">
                            <Checkbox 
                              checked={selectedOrderIds.includes(order.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedOrderIds(prev => [...prev, order.id]);
                                } else {
                                  setSelectedOrderIds(prev => prev.filter(id => id !== order.id));
                                }
                              }}
                            />
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-400 text-xs">
                              {order.user.firstName.charAt(0)}{order.user.lastName.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                {order.user.firstName} {order.user.lastName}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                                {order.user.department || 'No Dept'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-0.5">
                            <div className="font-bold text-sm flex items-center gap-2">
                              {order.mealType}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                              <CalendarIcon className="w-3 h-3" />
                              {format(new Date(order.date), 'MMM d, yyyy')}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="secondary" className="capitalize">{order.location || 'N/A'}</Badge>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(order.status)}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-slate-500 max-w-[200px] truncate italic">
                            {order.notes || '-'}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isAdmin && order.status === 'PENDING' && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 rounded-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => handleUpdateStatus(order.id, 'APPROVED')}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 rounded-full text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                  onClick={() => handleUpdateStatus(order.id, 'REJECTED')}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
