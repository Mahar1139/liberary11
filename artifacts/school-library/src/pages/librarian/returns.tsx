import { useState, useRef } from "react";
import LibrarianLayout from "@/components/layout/librarian-layout";
import { useListIssues, useGetMyProfile, useGetSchool, getListIssuesQueryKey, getListBooksQueryKey, getGetLibrarianDashboardQueryKey, ListIssuesStatus, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { BookCheck, AlertTriangle, RefreshCw, IndianRupee, Printer, Banknote, Smartphone } from "lucide-react";
import { toast } from "sonner";

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function calcOverdueDays(dueDate: string): number {
  const today = new Date();
  const due = new Date(dueDate);
  if (today <= due) return 0;
  return Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

type IssueRecord = {
  id: string; bookId: string; studentId: string; issuedBy: string;
  issueDate: string; dueDate: string; returnDate: string | null;
  fineAmount: number; finePaid: boolean; finePaymentMethod: string | null; status: string;
  bookTitle: string; bookAuthor: string;
  studentName: string; studentRollNumber: string; studentClass: string; studentSection: string;
  studentPhone?: string;
};

/* ─── Fine Receipt ─── */
function FineReceipt({ record, schoolName, paymentMethod }: {
  record: IssueRecord; schoolName: string; paymentMethod: string;
}) {
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return (
    <div className="p-6 space-y-4 text-sm font-sans" style={{ fontFamily: "monospace" }}>
      <div className="text-center border-b pb-3">
        <p className="font-bold text-base">{schoolName}</p>
        <p className="text-xs text-gray-500">Library Fine Receipt</p>
        <p className="text-xs text-gray-400">{today}</p>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between"><span className="text-gray-500">Student</span><span className="font-medium">{record.studentName}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Class</span><span>{record.studentClass}-{record.studentSection}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Roll No.</span><span>{record.studentRollNumber}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Book</span><span className="font-medium text-right max-w-[55%]">{record.bookTitle}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Issue Date</span><span>{formatDate(record.issueDate)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Due Date</span><span>{formatDate(record.dueDate)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Return Date</span><span>{formatDate(record.returnDate ?? new Date().toISOString().split("T")[0])}</span></div>
      </div>
      <div className="border-t border-dashed pt-3 space-y-1">
        <div className="flex justify-between font-bold text-base"><span>Fine Collected</span><span>₹{record.fineAmount.toFixed(2)}</span></div>
        <div className="flex justify-between text-gray-500"><span>Payment Method</span><span className="uppercase">{paymentMethod}</span></div>
      </div>
      <div className="border-t pt-3 text-center text-xs text-gray-400">
        <p>Thank you. Please return books on time.</p>
      </div>
    </div>
  );
}

/* ─── Collect Fine & Return Dialog ─── */
function CollectFineReturnDialog({ record, fineRatePerDay, schoolName, onClose }: {
  record: IssueRecord; fineRatePerDay: number; schoolName: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: profile } = useGetMyProfile();
  const schoolId = profile?.schoolId ?? "";
  const overdueDays = calcOverdueDays(record.dueDate);
  const [fineAmount, setFineAmount] = useState((overdueDays * fineRatePerDay).toFixed(2));
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi">("cash");
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<IssueRecord | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const handleCollect = async () => {
    setLoading(true);
    try {
      const result = await customFetch(`/api/issues/${record.id}/collect-fine-and-return`, {
        method: "POST",
        body: JSON.stringify({ fineAmount: parseFloat(fineAmount) || 0, paymentMethod }),
        headers: { "Content-Type": "application/json" },
      }) as IssueRecord;
      toast.success(`Fine collected & book returned`);
      qc.invalidateQueries({ queryKey: getListIssuesQueryKey({ schoolId, status: "issued" }) });
      qc.invalidateQueries({ queryKey: getListIssuesQueryKey({ schoolId, status: "overdue" }) });
      qc.invalidateQueries({ queryKey: getListBooksQueryKey({ schoolId }) });
      qc.invalidateQueries({ queryKey: getGetLibrarianDashboardQueryKey() });
      setReceipt({ ...record, fineAmount: parseFloat(fineAmount) || 0, finePaymentMethod: paymentMethod, returnDate: new Date().toISOString().split("T")[0] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w || !receiptRef.current) return;
    w.document.write(`<html><head><title>Fine Receipt</title><style>body{margin:0;padding:16px;font-family:monospace;font-size:13px;}*{box-sizing:border-box;}</style></head><body>${receiptRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  };

  if (receipt) {
    return (
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fine Receipt</DialogTitle>
            <DialogDescription>Fine collected successfully. Print the receipt for the student.</DialogDescription>
          </DialogHeader>
          <div ref={receiptRef} className="border rounded-lg">
            <FineReceipt record={receipt} schoolName={schoolName} paymentMethod={receipt.finePaymentMethod ?? paymentMethod} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" /> Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Collect Fine & Return Book</DialogTitle>
          <DialogDescription>Collect the overdue fine and return the book in one step</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Student</span><span className="font-medium">{record.studentName} ({record.studentClass}-{record.studentSection})</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Book</span><span className="font-medium text-right max-w-[55%]">{record.bookTitle}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Due Date</span><span className="text-destructive font-medium">{formatDate(record.dueDate)}</span></div>
            {overdueDays > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Overdue</span><span className="text-destructive font-medium">{overdueDays} days</span></div>}
          </div>

          {overdueDays > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
              <span className="text-destructive">Suggested: ₹{fineRatePerDay}/day × {overdueDays} days = <strong>₹{(overdueDays * fineRatePerDay).toFixed(2)}</strong></span>
            </div>
          )}

          {/* Fine Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Fine Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
              <Input type="number" min={0} step={0.5} className="pl-7" value={fineAmount} onChange={e => setFineAmount(e.target.value)} />
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Method</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors ${paymentMethod === "cash" ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-muted-foreground"}`}
              >
                <Banknote className="h-5 w-5" /> Cash
              </button>
              <button
                onClick={() => setPaymentMethod("upi")}
                className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors ${paymentMethod === "upi" ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-muted-foreground"}`}
              >
                <Smartphone className="h-5 w-5" /> UPI
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCollect} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
            <IndianRupee className="h-4 w-4 mr-2" />
            {loading ? "Processing..." : "Collect & Return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Return (no fine) Dialog ─── */
function ReturnDialog({ record, onClose }: { record: IssueRecord; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: profile } = useGetMyProfile();
  const schoolId = profile?.schoolId ?? "";
  const [loading, setLoading] = useState(false);

  const handleReturn = async () => {
    setLoading(true);
    try {
      const result = await customFetch(`/api/issues/${record.id}/return`, { method: "POST" }) as any;
      toast.success(`Book returned${result.fineAmount > 0 ? ` — Fine: ₹${result.fineAmount.toFixed(2)}` : ""}`);
      qc.invalidateQueries({ queryKey: getListIssuesQueryKey({ schoolId, status: "issued" }) });
      qc.invalidateQueries({ queryKey: getListBooksQueryKey({ schoolId }) });
      qc.invalidateQueries({ queryKey: getGetLibrarianDashboardQueryKey() });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Return Book</DialogTitle><DialogDescription>Confirm book return</DialogDescription></DialogHeader>
        <div className="rounded-md bg-muted p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Book</span><span className="font-medium">{record.bookTitle}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Student</span><span className="font-medium">{record.studentName}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Due Date</span><span>{formatDate(record.dueDate)}</span></div>
        </div>
        <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground text-center">Returned on time — no fine applicable</div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleReturn} disabled={loading} data-testid="button-confirm-return">
            <BookCheck className="h-4 w-4 mr-2" />{loading ? "Processing..." : "Confirm Return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Renew Dialog ─── */
function RenewDialog({ record, onClose }: { record: IssueRecord; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: profile } = useGetMyProfile();
  const schoolId = profile?.schoolId ?? "";
  const [loading, setLoading] = useState(false);
  const defaultNew = new Date(); defaultNew.setDate(defaultNew.getDate() + 14);
  const minDate = new Date(); minDate.setDate(minDate.getDate() + 1);
  const [newDueDate, setNewDueDate] = useState(defaultNew.toISOString().split("T")[0]);

  const handleRenew = async () => {
    setLoading(true);
    try {
      await customFetch(`/api/issues/${record.id}/renew`, { method: "POST", body: JSON.stringify({ dueDate: newDueDate }), headers: { "Content-Type": "application/json" } });
      toast.success("Book renewed");
      qc.invalidateQueries({ queryKey: getListIssuesQueryKey({ schoolId, status: "issued" }) });
      qc.invalidateQueries({ queryKey: getListIssuesQueryKey({ schoolId, status: "overdue" }) });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Renew Book</DialogTitle><DialogDescription>Extend the due date</DialogDescription></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Book</span><span className="font-medium">{record.bookTitle}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Student</span><span className="font-medium">{record.studentName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Current Due</span><span className={record.status === "overdue" ? "text-destructive font-medium" : ""}>{formatDate(record.dueDate)}</span></div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">New Due Date</label>
            <Input type="date" value={newDueDate} min={minDate.toISOString().split("T")[0]} onChange={e => setNewDueDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleRenew} disabled={loading || !newDueDate}>
            <RefreshCw className="h-4 w-4 mr-2" />{loading ? "Renewing..." : "Renew"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Mark Fine Paid Dialog ─── */
function MarkFinePaidDialog({ record, onClose }: { record: IssueRecord; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: profile } = useGetMyProfile();
  const schoolId = profile?.schoolId ?? "";
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi">("cash");
  const [receipt, setReceipt] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const { data: school } = useGetSchool({ id: schoolId }, { enabled: !!schoolId });
  const schoolName = (school as any)?.name ?? "School Library";

  const handlePay = async () => {
    setLoading(true);
    try {
      await customFetch(`/api/issues/${record.id}/mark-fine-paid`, { method: "POST", headers: { "Content-Type": "application/json" } });
      toast.success(`Fine of ₹${record.fineAmount.toFixed(2)} collected`);
      qc.invalidateQueries({ queryKey: getListIssuesQueryKey({ schoolId, status: "returned" }) });
      qc.invalidateQueries({ queryKey: getGetLibrarianDashboardQueryKey() });
      setReceipt(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally { setLoading(false); }
  };

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w || !receiptRef.current) return;
    w.document.write(`<html><head><title>Fine Receipt</title><style>body{margin:0;padding:16px;font-family:monospace;font-size:13px;}</style></head><body>${receiptRef.current.innerHTML}</body></html>`);
    w.document.close(); w.print();
  };

  if (receipt) {
    return (
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Fine Receipt</DialogTitle><DialogDescription>Print the receipt for the student.</DialogDescription></DialogHeader>
          <div ref={receiptRef} className="border rounded-lg">
            <FineReceipt record={{ ...record, finePaymentMethod: paymentMethod }} schoolName={schoolName} paymentMethod={paymentMethod} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Print Receipt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Collect Fine</DialogTitle><DialogDescription>Confirm fine collection from student</DialogDescription></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Student</span><span className="font-medium">{record.studentName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Book</span><span className="font-medium text-right max-w-[60%]">{record.bookTitle}</span></div>
          </div>
          <div className="rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 p-4 flex items-center gap-3">
            <IndianRupee className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div><p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Fine Amount</p><p className="text-xl font-bold text-amber-700 dark:text-amber-400">₹{record.fineAmount.toFixed(2)}</p></div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Method</label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setPaymentMethod("cash")} className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors ${paymentMethod === "cash" ? "border-primary bg-primary/5 text-primary" : "border-border"}`}>
                <Banknote className="h-5 w-5" />Cash
              </button>
              <button onClick={() => setPaymentMethod("upi")} className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors ${paymentMethod === "upi" ? "border-primary bg-primary/5 text-primary" : "border-border"}`}>
                <Smartphone className="h-5 w-5" />UPI
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handlePay} disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="button-mark-paid">
            <IndianRupee className="h-4 w-4 mr-2" />{loading ? "Collecting..." : "Collect Fine"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Page ─── */
export default function ReturnsPage() {
  const { data: profile } = useGetMyProfile();
  const schoolId = profile?.schoolId ?? "";
  const { data: school } = useGetSchool({ id: schoolId }, { enabled: !!schoolId });
  const fineRatePerDay = parseFloat((school as any)?.fineRatePerDay ?? "2");
  const schoolName = (school as any)?.name ?? "School Library";

  const [status, setStatus] = useState<ListIssuesStatus>(ListIssuesStatus.issued);
  const [search, setSearch] = useState("");
  const { data: issues, isLoading } = useListIssues({ schoolId, status });
  const [returning, setReturning] = useState<IssueRecord | null>(null);
  const [renewing, setRenewing] = useState<IssueRecord | null>(null);
  const [markingPaid, setMarkingPaid] = useState<IssueRecord | null>(null);
  const [collectFine, setCollectFine] = useState<IssueRecord | null>(null);

  const filtered = (issues ?? []).filter(r =>
    (r as any).studentName?.toLowerCase().includes(search.toLowerCase()) ||
    (r as any).bookTitle?.toLowerCase().includes(search.toLowerCase()) ||
    (r as any).studentRollNumber?.toLowerCase().includes(search.toLowerCase())
  ) as IssueRecord[];

  const isOverdueOrIssued = status === "issued" || status === "overdue";

  return (
    <LibrarianLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Returns</h1>
          <p className="text-sm text-muted-foreground mt-1">Process book returns, renewals, and fine collection</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Search by student, book, or roll number..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
          <Select value={status} onValueChange={(v) => setStatus(v as ListIssuesStatus)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ListIssuesStatus.issued}>Issued</SelectItem>
              <SelectItem value={ListIssuesStatus.overdue}>Overdue</SelectItem>
              <SelectItem value={ListIssuesStatus.returned}>Returned</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-11 w-full"/>)}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-5 py-3 font-medium">Student</th>
                    <th className="text-left px-5 py-3 font-medium">Book</th>
                    <th className="text-left px-5 py-3 font-medium">Issue Date</th>
                    <th className="text-left px-5 py-3 font-medium">Due Date</th>
                    <th className="text-left px-5 py-3 font-medium">Status</th>
                    <th className="text-right px-5 py-3 font-medium">Fine (₹)</th>
                    {status === "returned" && <th className="text-center px-5 py-3 font-medium">Fine Paid</th>}
                    <th className="text-right px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(record => {
                    const overdue = calcOverdueDays(record.dueDate) > 0 && record.status !== "returned";
                    return (
                      <tr key={record.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                        <td className="px-5 py-3">
                          <span className="font-medium">{record.studentName}</span>
                          <span className="text-xs text-muted-foreground ml-1">{record.studentClass}-{record.studentSection}</span>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{record.bookTitle}</td>
                        <td className="px-5 py-3 text-muted-foreground">{formatDate(record.issueDate)}</td>
                        <td className="px-5 py-3">
                          <span className={record.status === "overdue" ? "text-destructive font-medium" : "text-muted-foreground"}>{formatDate(record.dueDate)}</span>
                        </td>
                        <td className="px-5 py-3">
                          {record.status === "issued" && <Badge variant="secondary">Issued</Badge>}
                          {record.status === "overdue" && <Badge variant="destructive">Overdue</Badge>}
                          {record.status === "returned" && <Badge variant="outline">Returned</Badge>}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {record.fineAmount > 0 ? <span className="text-destructive font-medium">₹{record.fineAmount.toFixed(2)}</span> : <span className="text-muted-foreground">—</span>}
                        </td>
                        {status === "returned" && (
                          <td className="px-5 py-3 text-center">
                            {record.fineAmount > 0 ? (
                              record.finePaid
                                ? <Badge variant="outline" className="text-green-600 border-green-600">{record.finePaymentMethod?.toUpperCase() ?? "Collected"}</Badge>
                                : <Button size="sm" variant="outline" className="text-amber-600 border-amber-500 hover:bg-amber-50 h-7 text-xs" onClick={() => setMarkingPaid(record)}>
                                    <IndianRupee className="h-3 w-3 mr-1" />Collect
                                  </Button>
                            ) : <span className="text-muted-foreground text-xs">No fine</span>}
                          </td>
                        )}
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isOverdueOrIssued && overdue && (
                              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white h-8" onClick={() => setCollectFine(record)}>
                                <IndianRupee className="h-3.5 w-3.5 mr-1" /> Collect Fine
                              </Button>
                            )}
                            {isOverdueOrIssued && (
                              <Button size="sm" variant="outline" onClick={() => setRenewing(record)}>
                                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Renew
                              </Button>
                            )}
                            {isOverdueOrIssued && !overdue && (
                              <Button size="sm" onClick={() => setReturning(record)}>
                                <BookCheck className="h-3.5 w-3.5 mr-1" /> Return
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">No records found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
      {returning && <ReturnDialog record={returning} onClose={() => setReturning(null)} />}
      {renewing && <RenewDialog record={renewing} onClose={() => setRenewing(null)} />}
      {markingPaid && <MarkFinePaidDialog record={markingPaid} onClose={() => setMarkingPaid(null)} />}
      {collectFine && <CollectFineReturnDialog record={collectFine} fineRatePerDay={fineRatePerDay} schoolName={schoolName} onClose={() => setCollectFine(null)} />}
    </LibrarianLayout>
  );
}
