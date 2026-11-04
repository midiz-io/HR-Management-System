import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  FaFish,
  FaShoppingCart,
  FaFileInvoiceDollar,
  FaTruck,
  FaCheckCircle,
  FaMoneyBillWave,
  FaFileDownload,
  FaLock,
  FaSpinner,
  FaPlus,
  FaMinus,
  FaReceipt,
  FaCalendarAlt,
  FaUser,
  FaBoxes,
  FaClock
} from 'react-icons/fa';
import { format } from 'date-fns';

interface SeafoodItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  imageUrl?: string | null;
  description?: string | null;
  isAvailable: boolean;
}

interface OrderItem {
  id?: string;
  seafoodItemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  seafoodItem?: SeafoodItem;
}

interface SeafoodOrder {
  id: string;
  invoiceNumber: string;
  userId: string;
  totalAmount: number;
  status: 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  notes?: string | null;
  isDispatchedBySales: boolean;
  dispatchedAt?: string | null;
  isReceivedByEmployee: boolean;
  receivedAt?: string | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    department: string | null;
    position: string | null;
    email: string;
  };
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    seafoodItem: {
      name: string;
      unit: string;
      category: string;
    };
  }>;
}

interface MonthlyReportItem {
  id: string;
  userId: string;
  year: number;
  month: number;
  totalPurchases: number;
  totalCashPaid: number;
  netPendingBalance: number;
  isDeductedFromSalary: boolean;
  deductedAt?: string | null;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    department: string | null;
    position: string | null;
  };
}

const PendingBillsManagement: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const isSuperAdminOrHR = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || (user as any)?.department === 'HR';
  const isSalesStaff = isSuperAdminOrHR || (user as any)?.department?.toLowerCase().includes('sales');

  const [activeTab, setActiveTab] = useState<string>('store');

  // Catalog State
  const [catalog, setCatalog] = useState<SeafoodItem[]>([]);
  const [cart, setCart] = useState<{ [itemId: string]: number }>({});
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(true);

  // Orders State
  const [orders, setOrders] = useState<SeafoodOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(true);
  const [selectedInvoice, setSelectedInvoice] = useState<SeafoodOrder | null>(null);

  // Cash Payment Modal State (for Sales)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentEmployeeId, setPaymentEmployeeId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  // Monthly Report & HR Deductions
  const currentDate = new Date();
  const [reportYear, setReportYear] = useState<number>(currentDate.getFullYear());
  const [reportMonth, setReportMonth] = useState<number>(currentDate.getMonth() + 1);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReportItem[]>([]);
  const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);
  const [isConfirmingDeductions, setIsConfirmingDeductions] = useState<boolean>(false);

  // Action Loading tracking
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  // Fetch Catalog
  const fetchCatalog = async () => {
    setIsLoadingCatalog(true);
    try {
      const res = await fetch('/api/pending-bills/catalog');
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data?.items || []);
        setCatalog(items);
      } else {
        setCatalog([]);
      }
    } catch (err) {
      console.error('Error fetching seafood catalog:', err);
      setCatalog([]);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  // Fetch Orders
  const fetchOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const res = await fetch('/api/pending-bills/orders');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data?.orders || []);
        setOrders(list);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error('Error fetching seafood orders:', err);
      setOrders([]);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // Fetch Monthly Report
  const fetchMonthlyReport = async () => {
    setIsLoadingReport(true);
    try {
      const res = await fetch(`/api/pending-bills/monthly-report?year=${reportYear}&month=${reportMonth}`);
      if (res.ok) {
        const data = await res.json();
        const accounts = Array.isArray(data) ? data : (data?.accounts || []);
        setMonthlyReport(accounts);
      } else {
        setMonthlyReport([]);
      }
    } catch (err) {
      console.error('Error fetching monthly report:', err);
      setMonthlyReport([]);
    } finally {
      setIsLoadingReport(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
    fetchOrders();
    if (isSuperAdminOrHR || isSalesStaff) {
      fetchMonthlyReport();
    }
  }, [reportYear, reportMonth]);

  // Cart operations
  const updateCart = (itemId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[itemId] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: next };
    });
  };

  const cartTotal = useMemo(() => {
    if (!Array.isArray(catalog)) return 0;
    return Object.entries(cart).reduce((sum, [itemId, qty]) => {
      const item = catalog.find((c) => c.id === itemId);
      return sum + (item ? item.unitPrice * qty : 0);
    }, 0);
  }, [cart, catalog]);

  const cartItemCount = useMemo(() => {
    return Object.values(cart).reduce((sum, q) => sum + q, 0);
  }, [cart]);

  // Place Order
  const handlePlaceOrder = async () => {
    if (cartItemCount === 0) {
      toast({ variant: 'destructive', title: 'Cart Empty', description: 'Please add at least one item to order.' });
      return;
    }

    setIsPlacingOrder(true);
    try {
      const items = Object.entries(cart).map(([itemId, quantity]) => {
        const item = Array.isArray(catalog) ? catalog.find((c) => c.id === itemId) : null;
        return {
          id: itemId,
          itemId: itemId,
          seafoodItemId: itemId,
          name: item?.name,
          unit: item?.unit,
          quantity,
          unitPrice: item?.unitPrice || 0,
        };
      });

      const res = await fetch('/api/pending-bills/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, notes: orderNotes }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to place order');
      }

      const newOrder = await res.json();
      toast({
        title: 'Order Placed Successfully! 🦐',
        description: `Invoice: ${newOrder.invoiceNumber || newOrder.invoiceNo || 'INV'}. Total: LKR ${Number(newOrder.totalAmount || 0).toLocaleString()}`,
      });

      setCart({});
      setOrderNotes('');
      fetchOrders();
      setSelectedInvoice(newOrder);
      setActiveTab('orders');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Order Failed', description: err.message });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Sales Dispatch Confirmation
  const handleDispatchOrder = async (orderId: string) => {
    setActionInProgressId(orderId);
    try {
      const res = await fetch(`/api/pending-bills/${orderId}/dispatch`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to dispatch order');
      }
      toast({ title: 'Dispatched', description: 'Order marked as dispatched by Sales.' });
      fetchOrders();
      fetchMonthlyReport();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setActionInProgressId(null);
    }
  };

  // Employee Receive Confirmation
  const handleReceiveOrder = async (orderId: string) => {
    setActionInProgressId(orderId);
    try {
      const res = await fetch(`/api/pending-bills/${orderId}/receive`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to confirm receipt');
      }
      toast({
        title: 'Confirmed! ✅',
        description: 'You have confirmed receipt of your seafood order. Added to monthly pending bill.',
      });
      fetchOrders();
      fetchMonthlyReport();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setActionInProgressId(null);
    }
  };

  // Submit Cash Payment (Sales)
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentEmployeeId || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Input', description: 'Please choose an employee and amount.' });
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const res = await fetch('/api/pending-bills/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: paymentEmployeeId,
          amount: parseFloat(paymentAmount),
          notes: paymentNotes,
          year: reportYear,
          month: reportMonth,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to record payment');
      }

      toast({
        title: 'Payment Recorded! 💵',
        description: `LKR ${parseFloat(paymentAmount).toLocaleString()} cash payment deducted from pending balance.`,
      });

      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentNotes('');
      fetchMonthlyReport();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Confirm HR Salary Deductions
  const handleConfirmDeductions = async () => {
    if (!window.confirm(`Are you sure you want to lock and transfer all confirmed pending bills for ${reportYear}-${String(reportMonth).padStart(2, '0')} to employee salary payroll records? This will update monthly salary slips.`)) {
      return;
    }

    setIsConfirmingDeductions(true);
    try {
      const res = await fetch('/api/pending-bills/confirm-deductions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: reportYear, month: reportMonth }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to confirm deductions');
      }

      const result = await res.json();
      toast({
        title: 'Salary Deductions Confirmed! 💼',
        description: `Successfully synchronized ${result.processedCount} employee pending balances with payroll.`,
      });

      fetchMonthlyReport();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Deduction Sync Failed', description: err.message });
    } finally {
      setIsConfirmingDeductions(false);
    }
  };

  // Download CSV
  const handleDownloadCsv = () => {
    window.open(`/api/pending-bills/monthly-report?year=${reportYear}&month=${reportMonth}&format=csv`, '_blank');
  };

  // Summary KPIs for current report month
  const reportTotals = useMemo(() => {
    if (!Array.isArray(monthlyReport)) {
      return { totalPurchases: 0, totalCashPaid: 0, netPendingBalance: 0 };
    }
    return monthlyReport.reduce(
      (acc, curr) => ({
        totalPurchases: acc.totalPurchases + Number(curr.totalPurchases || 0),
        totalCashPaid: acc.totalCashPaid + Number(curr.totalCashPaid || 0),
        netPendingBalance: acc.netPendingBalance + Number(curr.netPendingBalance || 0),
      }),
      { totalPurchases: 0, totalCashPaid: 0, netPendingBalance: 0 }
    );
  }, [monthlyReport]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <FaFish className="text-cyan-600 dark:text-cyan-400" />
            Pending Bills & Seafood Purchases
          </h2>
          <p className="text-xs text-muted-foreground font-semibold mt-1 uppercase tracking-wider">
            Order fresh seafood, track deliveries, record sales cash settlements, & automate monthly payroll deductions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {cartItemCount > 0 && (
            <Badge className="bg-cyan-600 text-white font-bold px-3 py-1 text-sm shadow-md animate-pulse">
              Cart: {cartItemCount} items (LKR {cartTotal.toLocaleString()})
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full h-auto p-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
          <TabsTrigger value="store" className="py-2.5 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
            <FaShoppingCart /> Seafood Catalog
          </TabsTrigger>
          <TabsTrigger value="orders" className="py-2.5 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
            <FaReceipt /> My Orders & Delivery
          </TabsTrigger>
          {(isSalesStaff || isSuperAdminOrHR) && (
            <TabsTrigger value="sales" className="py-2.5 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
              <FaTruck /> Sales Portal
            </TabsTrigger>
          )}
          {(isSuperAdminOrHR || isSalesStaff) && (
            <TabsTrigger value="reports" className="py-2.5 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
              <FaFileInvoiceDollar /> Monthly Deductions
            </TabsTrigger>
          )}
        </TabsList>

        {/* ======================================================== */}
        {/* TAB 1: SEAFOOD CATALOG & ORDERING                        */}
        {/* ======================================================== */}
        <TabsContent value="store" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Catalog Grid */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <FaBoxes className="text-cyan-600" /> Fresh Seafood Price List
                </h3>
                <span className="text-xs text-muted-foreground">Prices in Sri Lankan Rupees (LKR)</span>
              </div>

              {isLoadingCatalog ? (
                <div className="py-16 text-center">
                  <FaSpinner className="animate-spin text-3xl mx-auto text-cyan-600 mb-2" />
                  <p className="text-xs text-muted-foreground">Loading fresh seafood catalog...</p>
                </div>
              ) : !Array.isArray(catalog) || catalog.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                  <FaFish className="text-4xl mx-auto opacity-30 mb-2" />
                  <p>No seafood items currently listed.</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Array.isArray(catalog) && catalog.map((item) => {
                    const quantity = cart[item.id] || 0;
                    return (
                      <Card
                        key={item.id}
                        className={`transition-all duration-200 border-2 ${
                          quantity > 0 ? 'border-cyan-500 shadow-md bg-cyan-50/20 dark:bg-cyan-950/20' : 'border-slate-100 dark:border-slate-800'
                        }`}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider mb-1">
                                {item.category}
                              </Badge>
                              <CardTitle className="text-base font-black">{item.name}</CardTitle>
                            </div>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                              LKR {item.unitPrice.toLocaleString()} / {item.unit}
                            </span>
                          </div>
                          {item.description && (
                            <CardDescription className="text-xs line-clamp-2 mt-1">
                              {item.description}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardFooter className="pt-2 flex justify-between items-center border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[11px] text-muted-foreground font-semibold">
                            {quantity > 0 ? `Subtotal: LKR ${(quantity * item.unitPrice).toLocaleString()}` : 'Available'}
                          </span>
                          <div className="flex items-center gap-2">
                            {quantity > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0 rounded-full"
                                onClick={() => updateCart(item.id, -1)}
                              >
                                <FaMinus className="h-2.5 w-2.5" />
                              </Button>
                            )}
                            {quantity > 0 && (
                              <span className="font-black text-sm w-6 text-center">{quantity}</span>
                            )}
                            <Button
                              size="sm"
                              className="h-8 px-3 rounded-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs"
                              onClick={() => updateCart(item.id, 1)}
                            >
                              <FaPlus className="h-2.5 w-2.5 mr-1" /> Add
                            </Button>
                          </div>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Shopping Cart & Order Summary */}
            <div className="space-y-4">
              <Card className="sticky top-4 border-2 border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-t-xl py-4">
                  <CardTitle className="text-lg font-black flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FaShoppingCart /> Order Summary
                    </span>
                    <Badge className="bg-white/20 text-white text-xs">{cartItemCount} items</Badge>
                  </CardTitle>
                  <CardDescription className="text-white/80 text-xs">
                    Charges will be added to your monthly pending bill.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {cartItemCount === 0 ? (
                    <div className="text-center py-8 text-muted-foreground space-y-2">
                      <FaShoppingCart className="text-3xl mx-auto opacity-30" />
                      <p className="text-xs font-semibold">Your cart is currently empty.</p>
                      <p className="text-[11px]">Select items from the catalog to place your order.</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {Object.entries(cart).map(([itemId, qty]) => {
                          const item = Array.isArray(catalog) ? catalog.find((c) => c.id === itemId) : null;
                          if (!item) return null;
                          return (
                            <div key={itemId} className="flex justify-between items-center py-2 border-b text-xs">
                              <div className="flex-1 pr-2">
                                <p className="font-bold">{item.name}</p>
                                <p className="text-muted-foreground text-[10px]">
                                  {qty} {item.unit} × LKR {item.unitPrice.toLocaleString()}
                                </p>
                              </div>
                              <span className="font-black text-cyan-600 dark:text-cyan-400">
                                LKR {(qty * item.unitPrice).toLocaleString()}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <Label className="text-xs font-bold">Delivery / Special Notes</Label>
                        <Textarea
                          placeholder="e.g. Please deliver before 4 PM, pack in ice box..."
                          className="text-xs h-20 resize-none"
                          value={orderNotes}
                          onChange={(e) => setOrderNotes(e.target.value)}
                        />
                      </div>

                      <div className="border-t pt-3 flex justify-between items-center">
                        <div>
                          <p className="text-xs text-muted-foreground font-semibold uppercase">Total Invoice Amount</p>
                          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                            LKR {cartTotal.toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-rose-500 hover:text-rose-600"
                          onClick={() => setCart({})}
                        >
                          Clear
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
                <CardFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t rounded-b-xl">
                  <Button
                    className="w-full font-black text-sm bg-cyan-600 hover:bg-cyan-700 text-white shadow-md py-5"
                    disabled={cartItemCount === 0 || isPlacingOrder}
                    onClick={handlePlaceOrder}
                  >
                    {isPlacingOrder ? (
                      <FaSpinner className="animate-spin mr-2" />
                    ) : (
                      <FaReceipt className="mr-2" />
                    )}
                    Generate Invoice & Place Order
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 2: MY ORDERS & RECEIPT CONFIRMATION                  */}
        {/* ======================================================== */}
        <TabsContent value="orders" className="mt-6 space-y-6">
          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg font-black flex items-center gap-2">
                    <FaReceipt className="text-cyan-600" /> Seafood Invoices & Deliveries
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Confirm delivery upon receiving your items to finalize the pending bill.
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={fetchOrders} className="text-xs">
                  Refresh Orders
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingOrders ? (
                <div className="py-16 text-center">
                  <FaSpinner className="animate-spin text-3xl mx-auto text-cyan-600 mb-2" />
                  <p className="text-xs text-muted-foreground">Loading your orders...</p>
                </div>
              ) : !Array.isArray(orders) || orders.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground space-y-2">
                  <FaFileInvoiceDollar className="text-4xl mx-auto opacity-20" />
                  <p className="font-bold">No purchase orders placed yet.</p>
                  <Button size="sm" onClick={() => setActiveTab('store')} className="mt-2 text-xs bg-cyan-600 text-white">
                    Browse Seafood Catalog
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto w-full custom-scrollbar">
                  <Table>
                  <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Sales Dispatch</TableHead>
                      <TableHead>Employee Receipt</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(orders) && orders.map((order) => {
                      const isOwner = order.userId === user?.id;
                      const awaitingEmployeeReceipt = order.isDispatchedBySales && !order.isReceivedByEmployee;
                      return (
                        <TableRow key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                          <TableCell className="font-black text-cyan-600 dark:text-cyan-400">
                            {order.invoiceNumber || (order as any).invoiceNo || 'INV-PENDING'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {order.createdAt ? format(new Date(order.createdAt), 'MMM dd, yyyy') : 'N/A'}
                          </TableCell>
                          <TableCell className="text-xs max-w-xs truncate">
                            {order.items && Array.isArray(order.items)
                              ? order.items.map((i) => `${i.seafoodItem?.name || (i as any).itemName || 'Item'} (${i.quantity})`).join(', ')
                              : 'No items'}
                          </TableCell>
                          <TableCell className="font-black text-emerald-600 dark:text-emerald-400">
                            LKR {order.totalAmount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {order.isDispatchedBySales ? (
                              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-bold text-[10px]">
                                Dispatched
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                                Awaiting Dispatch
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {order.isReceivedByEmployee ? (
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold text-[10px]">
                                Received
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-slate-500">
                                Not Confirmed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-[10px] font-bold ${
                                order.status === 'DELIVERED'
                                  ? 'bg-emerald-600 text-white'
                                  : order.status === 'DISPATCHED'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-amber-500 text-white'
                              }`}
                            >
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Invoice Dialog Trigger */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-8"
                                onClick={() => setSelectedInvoice(order)}
                              >
                                View Invoice
                              </Button>

                              {/* Employee Confirmation Button */}
                              {isOwner && awaitingEmployeeReceipt && (
                                <Button
                                  size="sm"
                                  className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                  disabled={actionInProgressId === order.id}
                                  onClick={() => handleReceiveOrder(order.id)}
                                >
                                  {actionInProgressId === order.id ? (
                                    <FaSpinner className="animate-spin mr-1" />
                                  ) : (
                                    <FaCheckCircle className="mr-1" />
                                  )}
                                  Confirm Received
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 3: SALES PORTAL (DISPATCH & CASH PAYMENTS)          */}
        {/* ======================================================== */}
        {(isSalesStaff || isSuperAdminOrHR) && (
          <TabsContent value="sales" className="mt-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-black flex items-center gap-2">
                  <FaTruck className="text-cyan-600" /> Sales Department Dispatch & Payment Operations
                </h3>
                <p className="text-xs text-muted-foreground">
                  Confirm order dispatches and record employee cash settlements towards their pending bills.
                </p>
              </div>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                onClick={() => setIsPaymentModalOpen(true)}
              >
                <FaMoneyBillWave className="mr-2" /> Record Cash Payment
              </Button>
            </div>

            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FaBoxes className="text-blue-600" /> Orders Awaiting Dispatch / In-Transit
                </CardTitle>
                <CardDescription className="text-xs">
                  Mark orders as dispatched once packaged and handed over to delivery.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto w-full custom-scrollbar">
                  <Table>
                  <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Items & Value</TableHead>
                      <TableHead>Dispatch Status</TableHead>
                      <TableHead>Receipt Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!Array.isArray(orders) || orders.filter((o) => !o.isDispatchedBySales || !o.isReceivedByEmployee).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-xs">
                          No pending delivery orders currently active. All orders dispatched and confirmed!
                        </TableCell>
                      </TableRow>
                    ) : (
                      (Array.isArray(orders) ? orders : [])
                        .filter((o) => !o.isDispatchedBySales || !o.isReceivedByEmployee)
                        .map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-black text-cyan-600">{order.invoiceNumber || (order as any).invoiceNo || 'INV-PENDING'}</TableCell>
                            <TableCell>
                              <div className="text-xs">
                                <p className="font-bold">{order.user?.firstName} {order.user?.lastName}</p>
                                <p className="text-muted-foreground text-[10px]">{order.user?.email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-semibold">{order.user?.department || 'N/A'}</TableCell>
                            <TableCell>
                              <div className="text-xs">
                                <span className="font-bold text-emerald-600">LKR {Number(order.totalAmount || 0).toLocaleString()}</span>
                                <p className="text-[10px] text-muted-foreground">
                                  {order.items?.length || 0} items ({order.items && Array.isArray(order.items) ? order.items.map((i) => i.seafoodItem?.name || (i as any).itemName || 'Item').join(', ') : ''})
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {order.isDispatchedBySales ? (
                                <Badge className="bg-blue-600 text-white text-[10px]">Dispatched</Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">
                                  Pending Dispatch
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {order.isReceivedByEmployee ? (
                                <Badge className="bg-emerald-600 text-white text-[10px]">Received</Badge>
                              ) : (
                                <Badge variant="outline" className="text-slate-500 text-[10px]">
                                  Pending Receipt
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {!order.isDispatchedBySales && (
                                <Button
                                  size="sm"
                                  className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold"
                                  disabled={actionInProgressId === order.id}
                                  onClick={() => handleDispatchOrder(order.id)}
                                >
                                  {actionInProgressId === order.id ? (
                                    <FaSpinner className="animate-spin mr-1" />
                                  ) : (
                                    <FaTruck className="mr-1" />
                                  )}
                                  Confirm Dispatched
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ======================================================== */}
        {/* TAB 4: HR MONTHLY REPORTS & SALARY DEDUCTIONS             */}
        {/* ======================================================== */}
        {(isSuperAdminOrHR || isSalesStaff) && (
          <TabsContent value="reports" className="mt-6 space-y-6">
            {/* Filter & Action Bar */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div>
                  <Label className="text-xs font-bold text-muted-foreground uppercase">Year</Label>
                  <Select value={String(reportYear)} onValueChange={(v) => setReportYear(Number(v))}>
                    <SelectTrigger className="w-28 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2025, 2026, 2027].map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-bold text-muted-foreground uppercase">Month</Label>
                  <Select value={String(reportMonth)} onValueChange={(v) => setReportMonth(Number(v))}>
                    <SelectTrigger className="w-36 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {format(new Date(2026, m - 1, 1), 'MMMM')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button size="sm" variant="outline" className="mt-4 text-xs font-bold" onClick={fetchMonthlyReport}>
                  Refresh
                </Button>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <Button size="sm" variant="outline" className="text-xs font-bold" onClick={handleDownloadCsv}>
                  <FaFileDownload className="mr-1.5" /> Export CSV Report
                </Button>

                {isSuperAdminOrHR && (
                  <Button
                    size="sm"
                    className="text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                    disabled={isConfirmingDeductions || monthlyReport.length === 0}
                    onClick={handleConfirmDeductions}
                  >
                    {isConfirmingDeductions ? (
                      <FaSpinner className="animate-spin mr-1.5" />
                    ) : (
                      <FaLock className="mr-1.5" />
                    )}
                    Confirm Salary Deductions
                  </Button>
                )}
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="py-3">
                  <CardDescription className="text-xs font-bold uppercase">Total Purchases Billed</CardDescription>
                  <CardTitle className="text-2xl font-black text-blue-600 dark:text-blue-400">
                    LKR {reportTotals.totalPurchases.toLocaleString()}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card className="border-l-4 border-l-emerald-500">
                <CardHeader className="py-3">
                  <CardDescription className="text-xs font-bold uppercase">Total Cash Recovered</CardDescription>
                  <CardTitle className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    LKR {reportTotals.totalCashPaid.toLocaleString()}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card className="border-l-4 border-l-rose-500">
                <CardHeader className="py-3">
                  <CardDescription className="text-xs font-bold uppercase">Net Payroll Deductions</CardDescription>
                  <CardTitle className="text-2xl font-black text-rose-600 dark:text-rose-400">
                    LKR {reportTotals.netPendingBalance.toLocaleString()}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Monthly Report Table */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FaFileInvoiceDollar className="text-cyan-600" /> Employee Pending Bill Balances for{' '}
                  {format(new Date(reportYear, reportMonth - 1, 1), 'MMMM yyyy')}
                </CardTitle>
                <CardDescription className="text-xs">
                  Net pending balance will be deducted from employee salary when deductions are confirmed.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingReport ? (
                  <div className="py-16 text-center">
                    <FaSpinner className="animate-spin text-3xl mx-auto text-cyan-600 mb-2" />
                    <p className="text-xs text-muted-foreground">Calculating monthly accounts...</p>
                  </div>
                ) : !Array.isArray(monthlyReport) || monthlyReport.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground text-xs font-semibold">
                    No confirmed seafood purchases or pending bills recorded for this month.
                  </div>
                ) : (
                  <div className="overflow-x-auto w-full custom-scrollbar">
                    <Table>
                    <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Total Purchases</TableHead>
                        <TableHead>Cash Paid</TableHead>
                        <TableHead>Net Pending Balance</TableHead>
                        <TableHead>Salary Deduction Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.isArray(monthlyReport) && monthlyReport.map((acc) => (
                        <TableRow key={acc.id}>
                          <TableCell>
                            <div>
                              <p className="font-bold text-xs">
                                {acc.user?.firstName} {acc.user?.lastName}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{acc.user?.email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-semibold">{acc.user?.department || 'N/A'}</TableCell>
                          <TableCell className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            LKR {acc.totalPurchases.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-emerald-600">
                            LKR {acc.totalCashPaid.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs font-black text-rose-600 dark:text-rose-400">
                            LKR {acc.netPendingBalance.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {acc.isDeductedFromSalary ? (
                              <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                                Deducted on {acc.deductedAt ? format(new Date(acc.deductedAt), 'MMM dd') : 'Payroll'}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">
                                Pending Payroll Sync
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* ======================================================== */}
      {/* INVOICE VIEWER DIALOG                                     */}
      {/* ======================================================== */}
      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent className="max-w-lg">
          {selectedInvoice && (
            <div className="space-y-4">
              <DialogHeader className="border-b pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <DialogTitle className="text-xl font-black text-cyan-700 dark:text-cyan-400 flex items-center gap-2">
                      <FaReceipt /> Invoice #{selectedInvoice.invoiceNumber || (selectedInvoice as any).invoiceNo || 'INV-PENDING'}
                    </DialogTitle>
                    <DialogDescription className="text-xs mt-1">
                      Issued on {selectedInvoice.createdAt ? format(new Date(selectedInvoice.createdAt), 'PPP p') : 'N/A'}
                    </DialogDescription>
                  </div>
                  <Badge
                    className={`font-black text-xs ${
                      selectedInvoice.status === 'DELIVERED'
                        ? 'bg-emerald-600 text-white'
                        : selectedInvoice.status === 'DISPATCHED'
                        ? 'bg-blue-600 text-white'
                        : 'bg-amber-500 text-white'
                    }`}
                  >
                    {selectedInvoice.status}
                  </Badge>
                </div>
              </DialogHeader>

              {/* Customer & Department Details */}
              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border text-xs grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground uppercase font-bold text-[10px] block">Customer</span>
                  <span className="font-bold">
                    {selectedInvoice.user?.firstName} {selectedInvoice.user?.lastName}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">{selectedInvoice.user?.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase font-bold text-[10px] block">Department</span>
                  <span className="font-bold">{selectedInvoice.user?.department || 'N/A'}</span>
                  <span className="text-[10px] text-muted-foreground block">{selectedInvoice.user?.position || 'Employee'}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-100 dark:bg-slate-800">
                    <TableRow>
                      <TableHead className="text-xs">Item</TableHead>
                      <TableHead className="text-xs text-right">Qty</TableHead>
                      <TableHead className="text-xs text-right">Price</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice.items && Array.isArray(selectedInvoice.items) ? (
                      selectedInvoice.items.map((item, idx) => (
                        <TableRow key={idx} className="text-xs">
                          <TableCell className="font-semibold">{item.seafoodItem?.name || (item as any).itemName || 'Item'}</TableCell>
                          <TableCell className="text-right">{item.quantity} {item.seafoodItem?.unit || (item as any).itemUnit || 'kg'}</TableCell>
                          <TableCell className="text-right">LKR {Number(item.unitPrice || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-black">
                            LKR {Number(item.totalPrice || (item as any).subtotal || (item.quantity * item.unitPrice) || 0).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-4 text-xs text-muted-foreground">No items in this order</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Total & Notes */}
              <div className="space-y-2">
                {selectedInvoice.notes && (
                  <p className="text-xs italic bg-slate-50 dark:bg-slate-900 p-2 rounded border">
                    Note: "{selectedInvoice.notes}"
                  </p>
                )}

                <div className="flex justify-between items-center text-sm font-black p-3 bg-cyan-50 dark:bg-cyan-950/40 rounded-lg border border-cyan-200 dark:border-cyan-800">
                  <span>Grand Total (LKR):</span>
                  <span className="text-lg text-emerald-600 dark:text-emerald-400">
                    LKR {selectedInvoice.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <DialogFooter className="flex justify-between sm:justify-between items-center gap-2 border-t pt-3">
                <Button size="sm" variant="outline" onClick={() => window.print()} className="text-xs">
                  Print Invoice
                </Button>
                <Button size="sm" onClick={() => setSelectedInvoice(null)} className="text-xs">
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* RECORD CASH PAYMENT MODAL (SALES)                         */}
      {/* ======================================================== */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-black flex items-center gap-2">
                <FaMoneyBillWave className="text-emerald-600" /> Record Sales Cash Payment
              </DialogTitle>
              <DialogDescription className="text-xs">
                Record cash handed over by an employee to reduce their monthly seafood pending bill balance.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-bold">Select Employee</Label>
                <Select value={paymentEmployeeId} onValueChange={setPaymentEmployeeId}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Choose employee..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {Array.isArray(monthlyReport) && monthlyReport.map((acc) => (
                      <SelectItem key={acc.user?.id || acc.userId} value={acc.user?.id || acc.userId}>
                        {acc.user?.firstName} {acc.user?.lastName} ({acc.user?.department || 'N/A'}) - Net Due: LKR {Number(acc.netPendingBalance || 0).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold">Payment Amount (LKR)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 5000"
                  className="text-sm font-bold"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  min="1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-bold">Receipt Notes / Reference</Label>
                <Input
                  type="text"
                  placeholder="e.g. Handed cash to Sales desk / Receipt #0482"
                  className="text-xs"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="border-t pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsPaymentModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                disabled={isSubmittingPayment}
              >
                {isSubmittingPayment ? <FaSpinner className="animate-spin mr-2" /> : <FaCheckCircle className="mr-2" />}
                Record Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PendingBillsManagement;
