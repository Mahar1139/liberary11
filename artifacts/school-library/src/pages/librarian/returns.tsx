import { useState } from "react";
import LibrarianLayout from "@/components/layout/librarian-layout";
import { useListIssues, useReturnBook, useGetMyProfile, useGetSchool, getListIssuesQueryKey, getListBooksQueryKey, getGetLibrarianDashboardQueryKey, ListIssuesStatus, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { BookCheck, AlertTriangle, RefreshCw, IndianRupee } from "lucide-react";
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
  const diffMs = today.getTime() - due.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

type IssueRecord = {
  id: string; bookId: string; studentId: string; issuedBy: string;
  issueDate: string; dueDate: string; returnDate: string | null;
  fineAmount: number; finePaid: boolean; status: string;
  bookTitle: string; bookAuthor: string;
  studentName: string; studentRollNumber: string; studentClass: string; studentSection: string;
  studentPhone?: string;
};

function ReturnDialog({ record, fineRatePerDay, onClose }: { record: IssueRecord; fineRatePerDay: number; onClose: () => void }) {
  const qc = useQueryClient();
  const returnBook = useReturnBook();
  const { data: profile } = useGetMyProfile();
  const schoolId = profile?.schoolId ?? "";
  const overdueDays = calcOverdueDays(record.dueDate);
  const isOverdue = overdueDays > 0;
  const estimatedFine = overdueDays * fineRatePerDay;

  const handleReturn = () => {
    returnBook.mutate({ id: record.id }, {
      onSuccess: (result) => {
        toast.success(`Book returned${(result as any).fineAmount > 0 ? ` — Fine: ₹${(result as any).fineAmount.toFixed(2)}` : ""}`);
        qc.invalidateQueries({ queryKey: getListIssuesQueryKey({ schoolId, status: "issued" }) });
        qc.invalidateQueries({ queryKey: getListIssuesQueryKey({ schoolId, status: "overdue" }) });
        qc.invalidateQueries({ queryKey: getListBooksQueryKey({ schoolId }) });
        qc.invalidateQueries({ queryKey: getGetLibrarianDashboardQueryKey() });
        onClose();
      },
      onError: () => toast.error("Failed to process return"),
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Return Book</DialogTitle>
          <DialogDescription>Confirm book return details below</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Book</span>
              <span className="font-medium text-right max-w-[60%]">{record.bookTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Student</span>
              <span className="font-medium">{record.studentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Issue Date</span>
              <span>{formatDate(record.issueDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due Date</span>
              <span className={isOverdue ? "text-destructive font-medium" : ""}>{formatDate(record.dueDate)}</span>
            </div>
          </div>
          {isOverdue && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 flex items-start gap-3" data-testid="card-fine-amount">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-destructive">Overdue Fine</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  ₹{estimatedFine.toFixed(2)} (₹{fineRatePerDay}/day × {overdueDays} days)
                </p>
              </div>
            </div>
          )}
          {!isOverdue && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground text-center">
              Returned on time — no fine applicable
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleReturn} disabled={returnBook.isPending} data-testid="button-confirm-return">
            <BookCheck className="h-4 w-4 mr-2" />
            {returnBook.isPending ? "Processing..." : "Confirm Return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenewDialog({ record, onClose }: { record: IssueRecord; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: profile } = useGetMyProfile();
  const schoolId = profile?.schoolId ?? "";
  const [loading, setLoading] = useState(false);

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const defaultNew = new Date();
  defaultNew.setDate(defaultNew.getDate() + 14);
  const [newDueDate, setNewDueDate] = useState(defaultNew.toISOString().split("T")[0]);

  const handleRenew = async () => {
    setLoading(true);
    try {
      await customFetch(`/api/issues/${record.id}/renew`, {
        method: "POST",
        body: JSON.stringify({ dueDate: newDueDate }),
        headers: { "Content-Type": "application/json" },
      });
      toast.success("Book renewed successfully");
      qc.invalidateQueries({ queryKey: getListIssuesQueryKey({ schoolId, status: "issued" }) });
      qc.invalidateQueries({ queryKey: getListIssuesQueryKey({ schoolId, status: "overdue" }) });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to renew book");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renew Book</DialogTitle>
          <DialogDescription>Extend the due date for this issued book</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Book</span>
              <span className="font-medium text-right max-w-[60%]">{record.bookTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Student</span>
              <span className="font-medium">{record.studentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Due Date</span>
              <span className={record.status === "overdue" ? "text-destructive font-medium" : ""}>{formatDate(record.dueDate)}</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">New Due Date</label>
            <Input
              type="date"
              value={newDueDate}
              min={minDate.toISOString().split("T")[0]}
              onChange={e => setNewDueDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleRenew} disabled={loading || !newDueDate}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {loading ? "Renewing..." : "Renew Book"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SetFineDialog({ record, fineRatePerDay, onClose }: { record: IssueRecord; fineRatePerDay: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: profile } = useGetMyProfile();
  const schoolId = profile?.schoolId ?? "";
  const overdueDays = calcOverdueDays(record.dueDate);
  const suggested = overdueDays > 0 ? (overdueDays * fineRatePerDay).toFixed(2) : "0";
  const [fineAmount, setFineAmount] = useState(suggested);
  const [loading, setLoading] = useState(false);

  const handleSetFine = async () => {
    setLoading(true);
    try {
      await customFetch(`/api/issues/${record.id}/set-fine`, {
        method: "POST",
        body: JSON.stringify({ fineAmount: parseFloat(fineAmount) }),
        headers: { "Content-Type": "application/json" },
      });
      toast.success(`Fine of ₹${parseFloat(fineAmount).toFixed(2)} set for ${record.studentName}`);
      qc.invalidateQueries({ queryKey: getListIssuesQueryKey({ schoolId, status: "issued" }) });
      qc.invalidateQueries({ queryKey: getListIssuesQueryKey({ schoolId, status: "overdue" }) });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to set fine");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add / Set Fine</DialogTitle>
          <DialogDescription>Set the overdue fine amount for this book</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Student</span>
              <span className="font-medium">{record.studentName} ({record.studentClass}-{record.studentSection})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Book</span>
              <span className="font-medium text-right max-w-[55%]">{record.bookTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due Date</span>
              <span className="text-destructive font-medium">{formatDate(record.dueDate)}</span>
            </div>
            {overdueDays > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Overdue Days</span>
                <span className="text-destructive font-medium">{overdueDays} days</span>
              </div>
            )}
          </div>

          {overdueDays > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-700 dark:text-amber-400">
              Suggested: ₹{fineRatePerDay}/day × {overdueDays} days = <strong>₹{suggested}</strong>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Fine Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
              <Input
                type="number"
                min={0}
                step={0.5}
                className="pl-7"
                value={fineAmount}
                onChange={e => setFineAmount(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">You can override the suggested amount if needed</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSetFine}
            disabled={loading || fineAmount === "" || isNaN(parseFloat(fineAmount))}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <IndianRupee className="h-4 w-4 mr-2" />
            {loading ? "Saving..." : "Set Fine"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarkFinePaidDialog({ record, onClose }: { record: IssueRecord; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: profile } = useGetMyProfile();
  const schoolId = profile?.schoolId ?? "";
  const [loading, setLoading] = useState(false);

  const handleMarkPaid = async () => {
    setLoading(true);
    try {
      await customFetch(`/api/issues/${record.id}/mark-fine-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      toast.success(`Fine of ₹${record.fineAmount.toFixed(2)} marked as collected`);
      qc.invalidateQueries({ queryKey: getListIssuesQueryKey({ schoolId, status: "returned" }) });
      qc.invalidateQueries({ queryKey: getGetLibrarianDashboardQueryKey() });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to mark fine as paid");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Fine as Collected</DialogTitle>
          <DialogDescription>Confirm that the fine has been collected from the student</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Student</span>
              <span className="font-medium">{record.studentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Book</span>
              <span className="font-medium text-right max-w-[60%]">{record.bookTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Return Date</span>
              <span>{formatDate(record.returnDate ?? "")}</span>
            </div>
          </div>
          <div className="rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 p-4 flex items-center gap-3">
            <IndianRupee className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Fine Amount</p>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-400">₹{record.fineAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleMarkPaid} disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white">
            <IndianRupee className="h-4 w-4 mr-2" />
            {loading ? "Marking..." : "Confirm Collection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ReturnsPage() {
  const { data: profile } = useGetMyProfile();
  const schoolId = profile?.schoolId ?? "";
  const { data: school } = useGetSchool({ id: schoolId }, { enabled: !!schoolId });
  const fineRatePerDay = parseFloat((school as any)?.fineRatePerDay ?? "2");

  const [status, setStatus] = useState<ListIssuesStatus>(ListIssuesStatus.issued);
  const [search, setSearch] = useState("");
  const { data: issues, isLoading } = useListIssues({ schoolId, status });
  const [returning, setReturning] = useState<IssueRecord | null>(null);
  const [renewing, setRenewing] = useState<IssueRecord | null>(null);
  const [markingPaid, setMarkingPaid] = useState<IssueRecord | null>(null);
  const [settingFine, setSettingFine] = useState<IssueRecord | null>(null);

  const filtered = (issues ?? []).filter(r =>
    (r as any).studentName?.toLowerCase().includes(search.toLowerCase()) ||
    (r as any).bookTitle?.toLowerCase().includes(search.toLowerCase()) ||
    (r as any).studentRollNumber?.toLowerCase().includes(search.toLowerCase())
  ) as IssueRecord[];

  const showReturnAction = status !== "returned";
  const showRenewAction = status === "issued" || status === "overdue";
  const showFineAction = status === "issued" || status === "overdue";

  return (
    <LibrarianLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Returns</h1>
          <p className="text-sm text-muted-foreground mt-1">Process book returns, renewals, and fine collection</p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Input
            placeholder="Search by student, book, or roll number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-sm"
            data-testid="input-search-returns"
          />
          <Select value={status} onValueChange={(v) => setStatus(v as ListIssuesStatus)}>
            <SelectTrigger className="w-36" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
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
                  {filtered.map(record => (
                    <tr key={record.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30" data-testid={`row-issue-${record.id}`}>
                      <td className="px-5 py-3">
                        <span className="font-medium">{record.studentName}</span>
                        <span className="text-xs text-muted-foreground ml-1">{record.studentClass}-{record.studentSection}</span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{record.bookTitle}</td>
                      <td className="px-5 py-3 text-muted-foreground">{formatDate(record.issueDate)}</td>
                      <td className="px-5 py-3">
                        <span className={record.status === "overdue" ? "text-destructive font-medium" : "text-muted-foreground"}>
                          {formatDate(record.dueDate)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {record.status === "issued" && <Badge variant="secondary">Issued</Badge>}
                        {record.status === "overdue" && <Badge variant="destructive">Overdue</Badge>}
                        {record.status === "returned" && <Badge variant="outline">Returned</Badge>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {record.fineAmount > 0
                          ? <span className="text-destructive font-medium">₹{record.fineAmount.toFixed(2)}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      {status === "returned" && (
                        <td className="px-5 py-3 text-center">
                          {record.fineAmount > 0 ? (
                            record.finePaid
                              ? <Badge variant="outline" className="text-green-600 border-green-600">Collected</Badge>
                              : <Button size="sm" variant="outline" className="text-amber-600 border-amber-500 hover:bg-amber-50 h-7 text-xs" onClick={() => setMarkingPaid(record)} data-testid={`button-mark-paid-${record.id}`}>
                                  <IndianRupee className="h-3 w-3 mr-1" />Mark Paid
                                </Button>
                          ) : <span className="text-muted-foreground text-xs">No fine</span>}
                        </td>
                      )}
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {showFineAction && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-amber-600 border-amber-500 hover:bg-amber-50 h-8"
                              onClick={() => setSettingFine(record)}
                              data-testid={`button-set-fine-${record.id}`}
                            >
                              <IndianRupee className="h-3.5 w-3.5 mr-1" /> Fine
                            </Button>
                          )}
                          {showRenewAction && (
                            <Button size="sm" variant="outline" onClick={() => setRenewing(record)} data-testid={`button-renew-${record.id}`}>
                              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Renew
                            </Button>
                          )}
                          {showReturnAction && (
                            <Button size="sm" onClick={() => setReturning(record)} data-testid={`button-return-${record.id}`}>
                              <BookCheck className="h-3.5 w-3.5 mr-1" /> Return
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">No records found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {returning && <ReturnDialog record={returning} fineRatePerDay={fineRatePerDay} onClose={() => setReturning(null)} />}
      {renewing && <RenewDialog record={renewing} onClose={() => setRenewing(null)} />}
      {markingPaid && <MarkFinePaidDialog record={markingPaid} onClose={() => setMarkingPaid(null)} />}
      {settingFine && <SetFineDialog record={settingFine} fineRatePerDay={fineRatePerDay} onClose={() => setSettingFine(null)} />}
    </LibrarianLayout>
  );
}
