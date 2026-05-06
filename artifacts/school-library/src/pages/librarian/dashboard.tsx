import LibrarianLayout from "@/components/layout/librarian-layout";
import { useGetLibrarianDashboard, useGetOverdueBooks, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Users, BookPlus, BookCheck, AlertTriangle, IndianRupee } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({ title, value, icon: Icon, danger }: { title: string; value: string | number; icon: React.ElementType; danger?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${danger ? "text-destructive" : "text-foreground"}`} data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
          </div>
          <div className={`p-2 rounded-md ${danger ? "bg-destructive/10" : "bg-primary/10"}`}>
            <Icon className={`h-5 w-5 ${danger ? "text-destructive" : "text-primary"}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function statusBadge(status: string) {
  if (status === "issued") return <Badge variant="secondary">Issued</Badge>;
  if (status === "returned") return <Badge variant="outline">Returned</Badge>;
  return <Badge variant="destructive">Overdue</Badge>;
}

export default function LibrarianDashboard() {
  const { data: stats, isLoading } = useGetLibrarianDashboard();
  const { data: overdue, isLoading: overdueLoading } = useGetOverdueBooks();
  const { data: recent, isLoading: recentLoading } = useGetRecentActivity({ limit: 8 });

  return (
    <LibrarianLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isLoading ? <Skeleton className="h-8 w-48 inline-block" /> : stats?.schoolName ?? "Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Library dashboard — today's overview</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-12 w-full" /></CardContent></Card>)
          ) : (
            <>
              <StatCard title="Total Books" value={stats?.totalBooks ?? 0} icon={BookOpen} />
              <StatCard title="Available" value={stats?.availableBooks ?? 0} icon={BookCheck} />
              <StatCard title="Total Students" value={stats?.totalStudents ?? 0} icon={Users} />
              <StatCard title="Issued Today" value={stats?.issuedToday ?? 0} icon={BookPlus} />
              <StatCard title="Returned Today" value={stats?.returnedToday ?? 0} icon={BookCheck} />
              <StatCard title="Overdue" value={stats?.overdueCount ?? 0} icon={AlertTriangle} danger={(stats?.overdueCount ?? 0) > 0} />
              <StatCard title="Fines Collected" value={`₹${(stats?.finesCollected ?? 0).toFixed(2)}`} icon={IndianRupee} />
            </>
          )}
        </div>

        {(overdueLoading || (overdue ?? []).length > 0) && (
          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Overdue Books
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {overdueLoading ? (
                <div className="p-4 space-y-2">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-8 w-full"/>)}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left px-5 py-2.5 font-medium">Student</th>
                      <th className="text-left px-5 py-2.5 font-medium">Book</th>
                      <th className="text-left px-5 py-2.5 font-medium">Due Date</th>
                      <th className="text-right px-5 py-2.5 font-medium">Fine (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(overdue ?? []).slice(0, 5).map(r => (
                      <tr key={r.id} className="border-b border-border/50 last:border-0" data-testid={`row-overdue-${r.id}`}>
                        <td className="px-5 py-2.5">{r.studentName} <span className="text-xs text-muted-foreground">{r.studentClass}-{r.studentSection}</span></td>
                        <td className="px-5 py-2.5 text-muted-foreground">{r.bookTitle}</td>
                        <td className="px-5 py-2.5 text-destructive">{formatDate(r.dueDate)}</td>
                        <td className="px-5 py-2.5 text-right font-medium">₹{r.fineAmount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentLoading ? (
              <div className="p-4 space-y-2">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-8 w-full"/>)}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-5 py-2.5 font-medium">Student</th>
                    <th className="text-left px-5 py-2.5 font-medium">Book</th>
                    <th className="text-left px-5 py-2.5 font-medium">Issued</th>
                    <th className="text-left px-5 py-2.5 font-medium">Due</th>
                    <th className="text-left px-5 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(recent ?? []).map(r => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0" data-testid={`row-activity-${r.id}`}>
                      <td className="px-5 py-2.5">{r.studentName}</td>
                      <td className="px-5 py-2.5 text-muted-foreground">{r.bookTitle}</td>
                      <td className="px-5 py-2.5 text-muted-foreground">{formatDate(r.issueDate)}</td>
                      <td className="px-5 py-2.5 text-muted-foreground">{formatDate(r.dueDate)}</td>
                      <td className="px-5 py-2.5">{statusBadge(r.status)}</td>
                    </tr>
                  ))}
                  {(recent ?? []).length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No activity yet</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </LibrarianLayout>
  );
}
