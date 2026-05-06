import SuperAdminLayout from "@/components/layout/super-admin-layout";
import { useGetSuperAdminDashboard, useGetSchoolStats, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { School, BookOpen, Users, AlertTriangle, IndianRupee, BookMarked } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({ title, value, icon: Icon, sub }: { title: string; value: string | number; icon: React.ElementType; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="p-2 rounded-md bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
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

export default function SuperAdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useGetSuperAdminDashboard();
  const { data: schoolStats, isLoading: schoolStatsLoading } = useGetSchoolStats();
  const { data: recent, isLoading: recentLoading } = useGetRecentActivity({ limit: 8 });

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">System-wide statistics across all schools</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {statsLoading ? (
            Array.from({ length: 7 }).map((_, i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-12 w-full" /></CardContent></Card>
            ))
          ) : (
            <>
              <StatCard title="Total Schools" value={stats?.totalSchools ?? 0} icon={School} />
              <StatCard title="Total Books" value={stats?.totalBooks ?? 0} icon={BookOpen} />
              <StatCard title="Total Students" value={stats?.totalStudents ?? 0} icon={Users} />
              <StatCard title="Active Issues" value={stats?.activeIssues ?? 0} icon={BookMarked} />
              <StatCard title="Overdue Books" value={stats?.overdueBooks ?? 0} icon={AlertTriangle} />
              <StatCard title="Librarians" value={stats?.totalLibrarians ?? 0} icon={Users} />
              <StatCard title="Fines Collected" value={`₹${(stats?.totalFinesCollected ?? 0).toFixed(2)}`} icon={IndianRupee} />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Books per School</CardTitle>
            </CardHeader>
            <CardContent>
              {schoolStatsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={schoolStats ?? []} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="schoolName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [v, "Books"]} />
                    <Bar dataKey="totalBooks" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Students per School</CardTitle>
            </CardHeader>
            <CardContent>
              {schoolStatsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={schoolStats ?? []} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="schoolName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [v, "Students"]} />
                    <Bar dataKey="totalStudents" fill="hsl(var(--chart-2))" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 font-medium">Student</th>
                      <th className="text-left py-2 font-medium">Book</th>
                      <th className="text-left py-2 font-medium">Issued</th>
                      <th className="text-left py-2 font-medium">Due</th>
                      <th className="text-left py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recent ?? []).map((r) => (
                      <tr key={r.id} className="border-b border-border/50 last:border-0" data-testid={`row-activity-${r.id}`}>
                        <td className="py-2.5">{r.studentName}</td>
                        <td className="py-2.5 text-muted-foreground">{r.bookTitle}</td>
                        <td className="py-2.5 text-muted-foreground">{formatDate(r.issueDate)}</td>
                        <td className="py-2.5 text-muted-foreground">{formatDate(r.dueDate)}</td>
                        <td className="py-2.5">{statusBadge(r.status)}</td>
                      </tr>
                    ))}
                    {(recent ?? []).length === 0 && (
                      <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No activity yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
