import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch, useGetMyProfile, useGetSchool, getGetSchoolQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Lock, IndianRupee, CheckCircle2, Clock, XCircle, CreditCard } from "lucide-react";

type Payment = {
  id: string; amount: number; paymentReference: string; notes: string;
  month: string; year: string; status: string;
  submittedAt: string; reviewedAt: string | null;
};

const months = [
  { value: "1", label: "January" }, { value: "2", label: "February" },
  { value: "3", label: "March" }, { value: "4", label: "April" },
  { value: "5", label: "May" }, { value: "6", label: "June" },
  { value: "7", label: "July" }, { value: "8", label: "August" },
  { value: "9", label: "September" }, { value: "10", label: "October" },
  { value: "11", label: "November" }, { value: "12", label: "December" },
];

function monthLabel(m: string) {
  return months.find(x => x.value === m)?.label ?? m;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const paymentSchema = z.object({
  amount: z.coerce.number().min(1, "Amount required"),
  paymentReference: z.string().min(3, "Reference number required (e.g. UPI transaction ID)"),
  notes: z.string().optional(),
  month: z.string().min(1, "Select month"),
  year: z.string().min(4, "Select year"),
});

type PaymentForm = z.infer<typeof paymentSchema>;

function SubmitPaymentDialog({ monthlyFee, onClose }: { monthlyFee: number; onClose: () => void }) {
  const qc = useQueryClient();
  const currentDate = new Date();

  const form = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: monthlyFee > 0 ? monthlyFee : undefined,
      paymentReference: "",
      notes: "",
      month: String(currentDate.getMonth() + 1),
      year: String(currentDate.getFullYear()),
    },
  });

  const submit = useMutation({
    mutationFn: (data: PaymentForm) => customFetch("/api/subscriptions/submit", {
      method: "POST",
      body: JSON.stringify({ ...data, amount: Number(data.amount) }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: () => {
      toast.success("Payment submitted successfully. Waiting for admin approval.");
      qc.invalidateQueries({ queryKey: ["my-payments"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to submit payment"),
  });

  const yearOptions = [
    String(currentDate.getFullYear()),
    String(currentDate.getFullYear() - 1),
  ];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit Payment</DialogTitle>
          <DialogDescription>Pay via UPI and enter your transaction ID below.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => submit.mutate(d))} className="space-y-4 py-2">

            {/* UPI payment info */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pay via UPI</p>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-base font-bold text-foreground select-all">asmaharg1139@oksbi</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Use any UPI app — Google Pay, PhonePe, Paytm</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-xl font-bold text-primary">₹{monthlyFee > 0 ? monthlyFee.toFixed(0) : "—"}</p>
                </div>
              </div>
            </div>

            {/* Month & Year — read-only, auto-set to current */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Month</label>
                <Input
                  className="bg-muted cursor-not-allowed text-muted-foreground"
                  value={monthLabel(String(currentDate.getMonth() + 1))}
                  readOnly
                  tabIndex={-1}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Year</label>
                <Input
                  className="bg-muted cursor-not-allowed text-muted-foreground"
                  value={String(currentDate.getFullYear())}
                  readOnly
                  tabIndex={-1}
                />
              </div>
            </div>

            {/* Amount — read-only, set by admin */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                <Input
                  type="number"
                  className="pl-7 bg-muted cursor-not-allowed text-muted-foreground"
                  value={monthlyFee > 0 ? monthlyFee : ""}
                  readOnly
                  tabIndex={-1}
                />
              </div>
              <p className="text-xs text-muted-foreground">Set by admin — cannot be changed</p>
            </div>

            <FormField control={form.control} name="paymentReference" render={({ field }) => (
              <FormItem>
                <FormLabel>UPI Transaction ID / Reference</FormLabel>
                <FormControl><Input placeholder="e.g. 412345678901" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (Optional)</FormLabel>
                <FormControl><Textarea placeholder="Any additional info..." {...field} rows={2} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={submit.isPending}>
                <CreditCard className="h-4 w-4 mr-2" />
                {submit.isPending ? "Submitting..." : "Submit Payment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function FrozenAccountScreen() {
  const { data: profile } = useGetMyProfile();
  const schoolId = profile?.schoolId ?? "";
  const { data: school } = useGetSchool(schoolId, {
    query: { enabled: !!schoolId, queryKey: getGetSchoolQueryKey(schoolId) },
  });
  const { data: payments } = useQuery<Payment[]>({
    queryKey: ["my-payments"],
    queryFn: () => customFetch("/api/subscriptions/my") as Promise<Payment[]>,
    enabled: !!schoolId,
  });
  const [submitting, setSubmitting] = useState(false);

  const hasPending = (payments ?? []).some(p => p.status === "pending");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mx-auto">
            <Lock className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Account Suspended</h1>
          <p className="text-muted-foreground">
            Your school's account has been suspended due to a pending subscription payment.
            Please submit your payment details and the admin will activate your account.
          </p>
        </div>

        {school?.monthlyFee && school.monthlyFee > 0 && (
          <Card className="border-destructive/30">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-2 rounded-md bg-amber-500/10">
                <IndianRupee className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Subscription Fee</p>
                <p className="text-2xl font-bold">₹{(school.monthlyFee as unknown as number).toFixed(0)}/month</p>
              </div>
            </CardContent>
          </Card>
        )}

        {hasPending ? (
          <Card className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-5 flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">Payment Under Review</p>
                <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">Your payment has been submitted and is awaiting admin approval. Please wait.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button className="w-full" size="lg" onClick={() => setSubmitting(true)}>
            <CreditCard className="h-5 w-5 mr-2" /> Submit Payment
          </Button>
        )}

        {(payments ?? []).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Recent Payments</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <tbody>
                  {(payments ?? []).slice(0, 5).map(p => (
                    <tr key={p.id} className="border-b border-border/50 last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-medium">{monthLabel(p.month)} {p.year}</p>
                        <p className="text-xs text-muted-foreground font-mono">{p.paymentReference}</p>
                      </td>
                      <td className="px-5 py-3 text-right">₹{p.amount.toFixed(0)}</td>
                      <td className="px-5 py-3">
                        {p.status === "approved" && <Badge variant="outline" className="text-green-600 border-green-500"><CheckCircle2 className="h-3 w-3 mr-1"/>Approved</Badge>}
                        {p.status === "pending" && <Badge variant="outline" className="text-amber-600 border-amber-500"><Clock className="h-3 w-3 mr-1"/>Pending</Badge>}
                        {p.status === "rejected" && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1"/>Rejected</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {submitting && (
        <SubmitPaymentDialog
          monthlyFee={school?.monthlyFee as unknown as number ?? 0}
          onClose={() => setSubmitting(false)}
        />
      )}
    </div>
  );
}

export default function SubscriptionPage() {
  const { data: profile } = useGetMyProfile();
  const schoolId = profile?.schoolId ?? "";
  const { data: school } = useGetSchool(schoolId, {
    query: { enabled: !!schoolId, queryKey: getGetSchoolQueryKey(schoolId) },
  });
  const { data: payments, isLoading } = useQuery<Payment[]>({
    queryKey: ["my-payments"],
    queryFn: () => customFetch("/api/subscriptions/my") as Promise<Payment[]>,
    enabled: !!schoolId,
  });
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscription</h1>
          <p className="text-sm text-muted-foreground mt-1">Your school's payment history and subscription status</p>
        </div>
        <Button onClick={() => setSubmitting(true)}>
          <CreditCard className="h-4 w-4 mr-2" /> Submit Payment
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Account Status</p>
            <div className="mt-2">
              {school?.status === "active"
                ? <Badge variant="outline" className="text-green-600 border-green-500 text-sm px-3 py-1">Active</Badge>
                : <Badge variant="destructive" className="text-sm px-3 py-1"><Lock className="h-3.5 w-3.5 mr-1"/>Suspended</Badge>
              }
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Monthly Fee</p>
            <p className="text-2xl font-bold mt-1">
              {school?.monthlyFee ? `₹${(school.monthlyFee as unknown as number).toFixed(0)}` : "—"}
              <span className="text-sm font-normal text-muted-foreground">/month</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Payment History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({length:3}).map((_,i)=><div key={i} className="h-10 bg-muted rounded animate-pulse"/>)}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-5 py-3 font-medium">Period</th>
                  <th className="text-right px-5 py-3 font-medium">Amount</th>
                  <th className="text-left px-5 py-3 font-medium">Reference</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {(payments ?? []).map(p => (
                  <tr key={p.id} className="border-b border-border/50 last:border-0">
                    <td className="px-5 py-3 font-medium">{monthLabel(p.month)} {p.year}</td>
                    <td className="px-5 py-3 text-right">₹{p.amount.toFixed(0)}</td>
                    <td className="px-5 py-3 font-mono text-xs">{p.paymentReference}</td>
                    <td className="px-5 py-3">
                      {p.status === "approved" && <Badge variant="outline" className="text-green-600 border-green-500"><CheckCircle2 className="h-3 w-3 mr-1"/>Approved</Badge>}
                      {p.status === "pending" && <Badge variant="outline" className="text-amber-600 border-amber-500"><Clock className="h-3 w-3 mr-1"/>Pending</Badge>}
                      {p.status === "rejected" && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1"/>Rejected</Badge>}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(p.submittedAt)}</td>
                  </tr>
                ))}
                {(payments ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">No payments submitted yet</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {submitting && (
        <SubmitPaymentDialog
          monthlyFee={school?.monthlyFee as unknown as number ?? 0}
          onClose={() => setSubmitting(false)}
        />
      )}
    </div>
  );
}
