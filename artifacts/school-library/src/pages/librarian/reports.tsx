import LibrarianLayout from "@/components/layout/librarian-layout";
import { useGetOverdueBooks, useGetRecentActivity, useGetLibrarianDashboard, useGetMyProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export default function LibrarianReports() {
  const { data: profile } = useGetMyProfile();
  const schoolId = profile?.schoolId ?? undefined;
  const { data: stats, isLoading: statsLoading } = useGetLibrarianDashboard();
  const { data: overdue, isLoading: overdueLoading } = useGetOverdueBooks({ schoolId });
  const { data: recent, isLoading: recentLoading } = useGetRecentActivity({ schoolId, limit: 20 });

  const summaryData = stats ? [
    { name: "Total Books", value: stats.totalBooks },
    { name: "Available", value: stats.availableBooks },
    { name: "Students", value: stats.totalStudents },
    { name: "Issued Today", value: stats.issuedToday },
    { name: "Returned Today", value: stats.returnedToday },
    { name: "Overdue", value: stats.overdueCount },
  ] : [];

  return (
    <LibrarianLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Library activity and fine reports</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {statsLoading ? (
            Array.from({length:3}).map((_,i)=><Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full"/></CardContent></Card>)
          ) : (
            <>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fines Collected</p>
                  <p className="text-3xl font-bold text-foreground mt-1" data-testid="stat-fines">₹{(stats?.finesCollected ?? 0).toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Overdue Books</p>
                  <p className={`text-3xl font-bold mt-1 ${(stats?.overdueCount ?? 0) > 0 ? "text-destructive" : "text-foreground"}`} data-testid="stat-overdue">{stats?.overdueCount ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Books Available</p>
                  <p className="text-3xl font-bold text-foreground mt-1" data-testid="stat-available">{stats?.availableBooks ?? 0} / {stats?.totalBooks ?? 0}</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Library Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-52 w-full" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={summaryData} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-destructive">Overdue Books</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {overdueLoading ? (
              <div className="p-4 space-y-2">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-5 py-3 font-medium">Student</th>
                    <th className="text-left px-5 py-3 font-medium">Book</th>
                    <th className="text-left px-5 py-3 font-medium">Due Date</th>
                    <th className="text-right px-5 py-3 font-medium">Fine (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(overdue ?? []).map(r => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30" data-testid={`row-overdue-${r.id}`}>
                      <td className="px-5 py-3">{r.studentName} <span className="text-xs text-muted-foreground">{r.studentClass}-{r.studentSection}</span></td>
                      <td className="px-5 py-3 text-muted-foreground">{r.bookTitle}</td>
                      <td className="px-5 py-3 text-destructive">{formatDate(r.dueDate)}</td>
                      <td className="px-5 py-3 text-right font-medium">₹{r.fineAmount.toFixed(2)}</td>
                    </tr>
                  ))}
                  {(overdue ?? []).length === 0 && (
                    <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">No overdue books</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Issue/Return History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentLoading ? (
              <div className="p-4 space-y-2">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-5 py-3 font-medium">Student</th>
                    <th className="text-left px-5 py-3 font-medium">Book</th>
                    <th className="text-left px-5 py-3 font-medium">Issued</th>
                    <th className="text-left px-5 py-3 font-medium">Due</th>
                    <th className="text-left px-5 py-3 font-medium">Status</th>
                    <th className="text-right px-5 py-3 font-medium">Fine (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(recent ?? []).map(r => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30" data-testid={`row-history-${r.id}`}>
                      <td className="px-5 py-3 font-medium">{r.studentName}</td>
                      <td className="px-5 py-3 text-muted-foreground">{r.bookTitle}</td>
                      <td className="px-5 py-3 text-muted-foreground">{formatDate(r.issueDate)}</td>
                      <td className="px-5 py-3 text-muted-foreground">{formatDate(r.dueDate)}</td>
                      <td className="px-5 py-3">
                        {r.status === "issued" && <Badge variant="secondary">Issued</Badge>}
                        {r.status === "overdue" && <Badge variant="destructive">Overdue</Badge>}
                        {r.status === "returned" && <Badge variant="outline">Returned</Badge>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {r.fineAmount > 0 ? <span className="text-destructive font-medium">₹{r.fineAmount.toFixed(2)}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                  {(recent ?? []).length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No history yet</td></tr>
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
