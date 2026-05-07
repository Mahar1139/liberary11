import { useState } from "react";
import SuperAdminLayout from "@/components/layout/super-admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Lock, Unlock, CheckCircle2, XCircle, IndianRupee, Clock, School, Banknote, Smartphone } from "lucide-react";

type SchoolSub = {
  id: string; name: string; contactEmail: string;
  status: "active" | "frozen";
  monthlyFee: number; fineRatePerDay: number; pendingPayments: number;
  lastPayment: { id: string; amount: number; month: string; year: string; status: string; submittedAt: string } | null;
};

type Payment = {
  id: string; schoolId: string; schoolName: string; schoolStatus: string;
  amount: number; paymentReference: string; notes: string;
  month: string; year: string; status: string;
  submittedAt: string; reviewedAt?: string | null;
};

type FineCollection = {
  id: string; schoolId: string; schoolName: string;
  bookTitle: string; studentName: string; studentClass: string; studentSection: string;
  fineAmount: number; finePaymentMethod: string; returnDate: string; createdAt: string;
};

function monthLabel(m: string) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const idx = parseInt(m) - 1;
  return months[idx] ?? m;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function FeeDialog({ school, onClose }: { school: SchoolSub; onClose: () => void }) {
  const [fee, setFee] = useState(school.monthlyFee.toString());
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => customFetch(`/api/schools/${school.id}/monthly-fee`, {
      method: "PATCH",
      body: JSON.stringify({ monthlyFee: parseFloat(fee) }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: () => {
      toast.success("Monthly fee updated");
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      onClose();
    },
    onError: () => toast.error("Failed to update fee"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set Monthly Fee</DialogTitle>
          <DialogDescription>{school.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
            <Input type="number" min={0} step={100} className="pl-7" value={fee} onChange={e => setFee(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">This is the monthly subscription fee for this school. Set to 0 for free.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FineRateDialog({ school, onClose }: { school: SchoolSub; onClose: () => void }) {
  const [rate, setRate] = useState((school.fineRatePerDay ?? 2).toString());
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => customFetch(`/api/schools/${school.id}/fine-rate`, {
      method: "PATCH",
      body: JSON.stringify({ fineRatePerDay: parseFloat(rate) }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: () => {
      toast.success("Fine rate updated");
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      onClose();
    },
    onError: () => toast.error("Failed to update fine rate"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set Overdue Fine Rate</DialogTitle>
          <DialogDescription>{school.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
            <Input type="number" min={0} step={0.5} className="pl-7" value={rate} onChange={e => setRate(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">Fine charged per overdue day on unreturned books. Set to 0 for no fine.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const allMonths = [
  { value: "1", label: "January" }, { value: "2", label: "February" },
  { value: "3", label: "March" }, { value: "4", label: "April" },
  { value: "5", label: "May" }, { value: "6", label: "June" },
  { value: "7", label: "July" }, { value: "8", label: "August" },
  { value: "9", label: "September" }, { value: "10", label: "October" },
  { value: "11", label: "November" }, { value: "12", label: "December" },
];

export default function SubscriptionsPage() {
  const qc = useQueryClient();
  const [settingFee, setSettingFee] = useState<SchoolSub | null>(null);
  const [settingFineRate, setSettingFineRate] = useState<SchoolSub | null>(null);
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");

  const { data: schools, isLoading: schoolsLoading } = useQuery<SchoolSub[]>({
    queryKey: ["subscriptions"],
    queryFn: () => customFetch("/api/subscriptions") as Promise<SchoolSub[]>,
  });

  const { data: pending, isLoading: pendingLoading } = useQuery<Payment[]>({
    queryKey: ["subscriptions-pending"],
    queryFn: () => customFetch("/api/subscriptions/pending") as Promise<Payment[]>,
  });

  const { data: allPayments, isLoading: allLoading } = useQuery<Payment[]>({
    queryKey: ["subscriptions-all"],
    queryFn: () => customFetch("/api/subscriptions/all") as Promise<Payment[]>,
  });

  const { data: fineCollections, isLoading: finesLoading } = useQuery<FineCollection[]>({
    queryKey: ["fine-collections"],
    queryFn: () => customFetch("/api/issues/fine-collections") as Promise<FineCollection[]>,
  });

  const freeze = useMutation({
    mutationFn: (id: string) => customFetch(`/api/schools/${id}/freeze`, { method: "POST" }),
    onSuccess: () => { toast.success("Account frozen"); qc.invalidateQueries({ queryKey: ["subscriptions"] }); },
    onError: () => toast.error("Failed to freeze account"),
  });

  const unfreeze = useMutation({
    mutationFn: (id: string) => customFetch(`/api/schools/${id}/unfreeze`, { method: "POST" }),
    onSuccess: () => { toast.success("Account activated"); qc.invalidateQueries({ queryKey: ["subscriptions"] }); },
    onError: () => toast.error("Failed to activate account"),
  });

  const approve = useMutation({
    mutationFn: (id: string) => customFetch(`/api/subscriptions/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Payment approved — school account activated");
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["subscriptions-pending"] });
      qc.invalidateQueries({ queryKey: ["subscriptions-all"] });
    },
    onError: () => toast.error("Failed to approve payment"),
  });

  const reject = useMutation({
    mutationFn: (id: string) => customFetch(`/api/subscriptions/${id}/reject`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Payment rejected");
      qc.invalidateQueries({ queryKey: ["subscriptions-pending"] });
      qc.invalidateQueries({ queryKey: ["subscriptions-all"] });
    },
    onError: () => toast.error("Failed to reject payment"),
  });

  const frozenCount = (schools ?? []).filter(s => s.status === "frozen").length;
  const pendingCount = (pending ?? []).length;

  return (
    <SuperAdminLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage school subscription payments and account status</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10"><School className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Schools</p>
                <p className="text-2xl font-bold">{schools?.length ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="p-2 rounded-md bg-destructive/10"><Lock className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Frozen Accounts</p>
                <p className="text-2xl font-bold text-destructive">{frozenCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-500/10"><Clock className="h-5 w-5 text-amber-500" /></div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending Payments</p>
                <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="schools">
          <TabsList>
            <TabsTrigger value="schools">Schools</TabsTrigger>
            <TabsTrigger value="pending" className="relative">
              Pending Payments
              {pendingCount > 0 && (
                <span className="ml-2 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">{pendingCount}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">Payment History</TabsTrigger>
            <TabsTrigger value="fines">Fine Collections</TabsTrigger>
          </TabsList>

          <TabsContent value="schools" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {schoolsLoading ? (
                  <div className="p-6 space-y-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left px-5 py-3 font-medium">School</th>
                        <th className="text-left px-5 py-3 font-medium">Status</th>
                        <th className="text-right px-5 py-3 font-medium">Monthly Fee</th>
                        <th className="text-right px-5 py-3 font-medium">Fine / Day</th>
                        <th className="text-left px-5 py-3 font-medium">Last Payment</th>
                        <th className="text-right px-5 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(schools ?? []).map(school => (
                        <tr key={school.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                          <td className="px-5 py-3">
                            <p className="font-medium">{school.name}</p>
                            <p className="text-xs text-muted-foreground">{school.contactEmail}</p>
                          </td>
                          <td className="px-5 py-3">
                            {school.status === "active"
                              ? <Badge variant="outline" className="text-green-600 border-green-500">Active</Badge>
                              : <Badge variant="destructive"><Lock className="h-3 w-3 mr-1" />Frozen</Badge>
                            }
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => setSettingFee(school)} className="text-primary hover:underline font-medium">
                              ₹{school.monthlyFee.toFixed(0)}/mo
                            </button>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => setSettingFineRate(school)} className="text-orange-600 hover:underline font-medium">
                              ₹{(school.fineRatePerDay ?? 0).toFixed(1)}/day
                            </button>
                          </td>
                          <td className="px-5 py-3">
                            {school.lastPayment ? (
                              <div>
                                <p className="text-sm">{monthLabel(school.lastPayment.month)} {school.lastPayment.year} — ₹{school.lastPayment.amount.toFixed(0)}</p>
                                <Badge variant="outline" className="text-xs mt-0.5">
                                  {school.lastPayment.status}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">No payments yet</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {school.pendingPayments > 0 && (
                                <Badge variant="outline" className="text-amber-600 border-amber-500 text-xs">
                                  {school.pendingPayments} pending
                                </Badge>
                              )}
                              {school.status === "active" ? (
                                <Button size="sm" variant="outline" className="text-destructive border-destructive hover:bg-destructive/10 h-8"
                                  onClick={() => freeze.mutate(school.id)} disabled={freeze.isPending}>
                                  <Lock className="h-3.5 w-3.5 mr-1" /> Freeze
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" className="text-green-600 border-green-500 hover:bg-green-50 h-8"
                                  onClick={() => unfreeze.mutate(school.id)} disabled={unfreeze.isPending}>
                                  <Unlock className="h-3.5 w-3.5 mr-1" /> Unfreeze
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(schools ?? []).length === 0 && (
                        <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No schools found</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {pendingLoading ? (
                  <div className="p-6 space-y-3">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-16 w-full"/>)}</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left px-5 py-3 font-medium">School</th>
                        <th className="text-left px-5 py-3 font-medium">Period</th>
                        <th className="text-right px-5 py-3 font-medium">Amount</th>
                        <th className="text-left px-5 py-3 font-medium">Reference</th>
                        <th className="text-left px-5 py-3 font-medium">Submitted</th>
                        <th className="text-right px-5 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pending ?? []).map(p => (
                        <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                          <td className="px-5 py-3">
                            <p className="font-medium">{p.schoolName}</p>
                            {p.schoolStatus === "frozen" && (
                              <Badge variant="destructive" className="text-xs mt-0.5"><Lock className="h-2.5 w-2.5 mr-1"/>Frozen</Badge>
                            )}
                          </td>
                          <td className="px-5 py-3">{monthLabel(p.month)} {p.year}</td>
                          <td className="px-5 py-3 text-right font-medium">₹{p.amount.toFixed(0)}</td>
                          <td className="px-5 py-3">
                            <p className="font-mono text-xs bg-muted rounded px-2 py-1 inline-block">{p.paymentReference}</p>
                            {p.notes && <p className="text-xs text-muted-foreground mt-1">{p.notes}</p>}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">{formatDate(p.submittedAt)}</td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8"
                                onClick={() => approve.mutate(p.id)} disabled={approve.isPending}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="text-destructive border-destructive hover:bg-destructive/10 h-8"
                                onClick={() => reject.mutate(p.id)} disabled={reject.isPending}>
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(pending ?? []).length === 0 && (
                        <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No pending payments</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-3">
            {/* Filters */}
            <div className="flex items-center gap-3">
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {allMonths.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i)).map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(filterMonth !== "all" || filterYear !== "all") && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterMonth("all"); setFilterYear("all"); }}>
                  Clear
                </Button>
              )}
            </div>
            <Card>
              <CardContent className="p-0">
                {allLoading ? (
                  <div className="p-6 space-y-3">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left px-5 py-3 font-medium">School</th>
                        <th className="text-left px-5 py-3 font-medium">Period</th>
                        <th className="text-right px-5 py-3 font-medium">Amount</th>
                        <th className="text-left px-5 py-3 font-medium">Reference</th>
                        <th className="text-left px-5 py-3 font-medium">Status</th>
                        <th className="text-left px-5 py-3 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(allPayments ?? [])
                        .filter(p => (filterMonth === "all" || p.month === filterMonth) && (filterYear === "all" || p.year === filterYear))
                        .map(p => (
                          <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                            <td className="px-5 py-3 font-medium">{p.schoolName}</td>
                            <td className="px-5 py-3">{monthLabel(p.month)} {p.year}</td>
                            <td className="px-5 py-3 text-right">₹{p.amount.toFixed(0)}</td>
                            <td className="px-5 py-3 font-mono text-xs">{p.paymentReference}</td>
                            <td className="px-5 py-3">
                              {p.status === "approved" && <Badge variant="outline" className="text-green-600 border-green-500">Approved</Badge>}
                              {p.status === "pending" && <Badge variant="outline" className="text-amber-600 border-amber-500">Pending</Badge>}
                              {p.status === "rejected" && <Badge variant="destructive">Rejected</Badge>}
                            </td>
                            <td className="px-5 py-3 text-muted-foreground">{formatDate(p.submittedAt)}</td>
                          </tr>
                        ))}
                      {((allPayments ?? []).filter(p => (filterMonth === "all" || p.month === filterMonth) && (filterYear === "all" || p.year === filterYear))).length === 0 && (
                        <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No payment history</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fines" className="mt-4 space-y-3">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-md bg-amber-500/10"><IndianRupee className="h-4 w-4 text-amber-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Collected</p>
                    <p className="text-2xl font-bold text-amber-600">₹{(fineCollections ?? []).reduce((s, r) => s + r.fineAmount, 0).toFixed(0)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-md bg-green-500/10"><Banknote className="h-4 w-4 text-green-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Cash</p>
                    <p className="text-2xl font-bold text-green-600">₹{(fineCollections ?? []).filter(r => r.finePaymentMethod === "cash").reduce((s, r) => s + r.fineAmount, 0).toFixed(0)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-md bg-blue-500/10"><Smartphone className="h-4 w-4 text-blue-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">UPI</p>
                    <p className="text-2xl font-bold text-blue-600">₹{(fineCollections ?? []).filter(r => r.finePaymentMethod === "upi").reduce((s, r) => s + r.fineAmount, 0).toFixed(0)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardContent className="p-0">
                {finesLoading ? (
                  <div className="p-6 space-y-3">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left px-5 py-3 font-medium">School</th>
                        <th className="text-left px-5 py-3 font-medium">Student</th>
                        <th className="text-left px-5 py-3 font-medium">Book</th>
                        <th className="text-left px-5 py-3 font-medium">Return Date</th>
                        <th className="text-center px-5 py-3 font-medium">Method</th>
                        <th className="text-right px-5 py-3 font-medium">Fine</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(fineCollections ?? []).map(r => (
                        <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                          <td className="px-5 py-3 font-medium">{r.schoolName}</td>
                          <td className="px-5 py-3">
                            <span>{r.studentName}</span>
                            <span className="text-xs text-muted-foreground ml-1">{r.studentClass}-{r.studentSection}</span>
                          </td>
                          <td className="px-5 py-3 text-muted-foreground max-w-[180px] truncate">{r.bookTitle}</td>
                          <td className="px-5 py-3 text-muted-foreground">{formatDate(r.returnDate)}</td>
                          <td className="px-5 py-3 text-center">
                            {r.finePaymentMethod === "upi"
                              ? <Badge variant="outline" className="text-blue-600 border-blue-400 gap-1"><Smartphone className="h-3 w-3"/>UPI</Badge>
                              : <Badge variant="outline" className="text-green-600 border-green-500 gap-1"><Banknote className="h-3 w-3"/>Cash</Badge>
                            }
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-amber-600">₹{r.fineAmount.toFixed(2)}</td>
                        </tr>
                      ))}
                      {(fineCollections ?? []).length === 0 && (
                        <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No fines collected yet</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {settingFee && <FeeDialog school={settingFee} onClose={() => setSettingFee(null)} />}
      {settingFineRate && <FineRateDialog school={settingFineRate} onClose={() => setSettingFineRate(null)} />}
    </SuperAdminLayout>
  );
}
