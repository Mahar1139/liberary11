import SuperAdminLayout from "@/components/layout/super-admin-layout";
import { useGetSchoolStats, useGetOverdueBooks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export default function SuperAdminReports() {
  const { data: schoolStats, isLoading: statsLoading } = useGetSchoolStats();
  const { data: overdue, isLoading: overdueLoading } = useGetOverdueBooks();

  return (
    <SuperAdminLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Cross-school performance and overdue tracking</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Books & Students by School</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? <Skeleton className="h-64 w-full" /> : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={schoolStats ?? []} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="schoolName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="totalBooks" name="Books" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                    <Bar dataKey="totalStudents" name="Students" fill="hsl(var(--chart-2))" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Issues & Overdue by School</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? <Skeleton className="h-64 w-full" /> : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={schoolStats ?? []} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="schoolName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="activeIssues" name="Active Issues" fill="hsl(var(--chart-4))" radius={[4,4,0,0]} />
                    <Bar dataKey="overdueCount" name="Overdue" fill="hsl(var(--destructive))" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">School Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {statsLoading ? (
              <div className="p-6 space-y-3">{Array.from({length: 3}).map((_,i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-6 py-3 font-medium">School</th>
                    <th className="text-right px-6 py-3 font-medium">Books</th>
                    <th className="text-right px-6 py-3 font-medium">Students</th>
                    <th className="text-right px-6 py-3 font-medium">Active</th>
                    <th className="text-right px-6 py-3 font-medium">Overdue</th>
                    <th className="text-right px-6 py-3 font-medium">Fines (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(schoolStats ?? []).map((s) => (
                    <tr key={s.schoolId} className="border-b border-border/50 last:border-0 hover:bg-muted/30" data-testid={`row-report-${s.schoolId}`}>
                      <td className="px-6 py-3 font-medium">{s.schoolName}</td>
                      <td className="px-6 py-3 text-right text-muted-foreground">{s.totalBooks}</td>
                      <td className="px-6 py-3 text-right text-muted-foreground">{s.totalStudents}</td>
                      <td className="px-6 py-3 text-right text-muted-foreground">{s.activeIssues}</td>
                      <td className="px-6 py-3 text-right">
                        {s.overdueCount > 0 ? <Badge variant="destructive">{s.overdueCount}</Badge> : <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="px-6 py-3 text-right text-muted-foreground">₹{s.finesCollected.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Overdue Books</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {overdueLoading ? (
              <div className="p-6 space-y-3">{Array.from({length: 3}).map((_,i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-6 py-3 font-medium">Student</th>
                    <th className="text-left px-6 py-3 font-medium">Book</th>
                    <th className="text-left px-6 py-3 font-medium">Due Date</th>
                    <th className="text-right px-6 py-3 font-medium">Fine (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(overdue ?? []).map((r) => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30" data-testid={`row-overdue-${r.id}`}>
                      <td className="px-6 py-3">{r.studentName} <span className="text-muted-foreground text-xs">({r.studentClass}-{r.studentSection})</span></td>
                      <td className="px-6 py-3 text-muted-foreground">{r.bookTitle}</td>
                      <td className="px-6 py-3 text-destructive">{formatDate(r.dueDate)}</td>
                      <td className="px-6 py-3 text-right font-medium">₹{r.fineAmount.toFixed(2)}</td>
                    </tr>
                  ))}
                  {(overdue ?? []).length === 0 && (
                    <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">No overdue books</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
