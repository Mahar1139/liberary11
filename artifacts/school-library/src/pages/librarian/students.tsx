import { useState, useRef } from "react";
import LibrarianLayout from "@/components/layout/librarian-layout";
import { useListStudents, useCreateStudent, useUpdateStudent, useDeleteStudent, useGetStudentBorrowHistory, useGetMyProfile, getListStudentsQueryKey, getGetStudentBorrowHistoryQueryKey } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, History, Upload, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const studentSchema = z.object({
  name: z.string().min(2, "Name required"),
  rollNumber: z.string().min(1, "Roll number required"),
  class: z.string().min(1, "Class required"),
  section: z.string().min(1, "Section required"),
  contactPhone: z.string().optional(),
});

type StudentForm = z.infer<typeof studentSchema>;
type Student = { id: string; schoolId: string; name: string; rollNumber: string; class: string; section: string; contactPhone?: string | null };

const STUDENT_CSV_SAMPLE = `name,rollNumber,class,section,contactPhone
Rahul Sharma,001,10,A,9876543210
Priya Singh,002,10,B,9123456780
Amit Kumar,003,9,A,`;

type ParsedStudentRow = {
  name: string;
  rollNumber: string;
  class: string;
  section: string;
  contactPhone: string;
  schoolId: string;
  error?: string;
};

function parseStudentsCsv(csv: string, schoolId: string): ParsedStudentRow[] {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map(h => h.trim().toLowerCase());
  const idx = (col: string) => header.indexOf(col);

  return lines.slice(1).map((line) => {
    const cols = line.split(",").map(c => c.trim());
    const name = cols[idx("name")] ?? "";
    const rollNumber = cols[idx("rollnumber")] ?? "";
    const cls = cols[idx("class")] ?? "";
    const section = cols[idx("section")] ?? "";
    const contactPhone = cols[idx("contactphone")] ?? "";

    const errors: string[] = [];
    if (!name || name.length < 2) errors.push("name missing/too short");
    if (!rollNumber) errors.push("rollNumber missing");
    if (!cls) errors.push("class missing");
    if (!section) errors.push("section missing");

    return { name, rollNumber, class: cls, section, contactPhone, schoolId, error: errors.length ? errors.join(", ") : undefined };
  });
}

function downloadSampleCsv() {
  const blob = new Blob([STUDENT_CSV_SAMPLE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sample_students.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function StudentsImportDialog({ open, schoolId, onClose }: { open: boolean; schoolId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedStudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");

  const validRows = rows.filter(r => !r.error);
  const errorRows = rows.filter(r => r.error);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRows(parseStudentsCsv(text, schoolId));
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setLoading(true);
    try {
      const payload = validRows.map(r => ({
        name: r.name,
        rollNumber: r.rollNumber,
        class: r.class,
        section: r.section,
        contactPhone: r.contactPhone,
        schoolId: r.schoolId,
      }));
      await customFetch("/api/students/bulk", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      toast.success(`${validRows.length} student(s) imported successfully`);
      qc.invalidateQueries({ queryKey: getListStudentsQueryKey({ schoolId }) });
      setRows([]);
      setFileName("");
      onClose();
    } catch {
      toast.error("Import failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setRows([]);
    setFileName("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Students from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: <code className="text-xs bg-muted px-1 py-0.5 rounded">name, rollNumber, class, section, contactPhone</code>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Choose CSV File
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadSampleCsv}>
              <Download className="h-4 w-4 mr-2" /> Download Sample
            </Button>
            {fileName && <span className="text-sm text-muted-foreground truncate">{fileName}</span>}
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </div>

          {rows.length > 0 && (
            <div className="flex-1 overflow-auto rounded-md border border-border">
              <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30 text-sm">
                <span className="flex items-center gap-1.5 text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> {validRows.length} ready
                </span>
                {errorRows.length > 0 && (
                  <span className="flex items-center gap-1.5 text-destructive">
                    <AlertCircle className="h-4 w-4" /> {errorRows.length} with errors (will be skipped)
                  </span>
                )}
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-3 py-2 font-medium">Name</th>
                    <th className="text-left px-3 py-2 font-medium">Roll No.</th>
                    <th className="text-left px-3 py-2 font-medium">Class</th>
                    <th className="text-left px-3 py-2 font-medium">Section</th>
                    <th className="text-left px-3 py-2 font-medium">Phone</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={`border-b border-border/50 last:border-0 ${r.error ? "bg-destructive/5" : ""}`}>
                      <td className="px-3 py-2 font-medium">{r.name || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.rollNumber || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.class || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.section || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.contactPhone || "—"}</td>
                      <td className="px-3 py-2">
                        {r.error
                          ? <span className="text-destructive">{r.error}</span>
                          : <span className="text-green-600">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rows.length === 0 && (
            <div className="rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center py-10 text-muted-foreground text-sm gap-2">
              <Upload className="h-8 w-8 opacity-40" />
              <p>Select a CSV file to preview data before importing</p>
              <p className="text-xs opacity-70">Headers: name, rollNumber, class, section, contactPhone</p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleImport} disabled={validRows.length === 0 || loading}>
            {loading ? "Importing..." : `Import ${validRows.length > 0 ? validRows.length + " Students" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function StudentFormDialog({ open, student, schoolId, onClose }: { open: boolean; student?: Student | null; schoolId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const create = useCreateStudent();
  const update = useUpdateStudent();

  const form = useForm<StudentForm>({
    resolver: zodResolver(studentSchema),
    defaultValues: { name: student?.name ?? "", rollNumber: student?.rollNumber ?? "", class: student?.class ?? "", section: student?.section ?? "", contactPhone: student?.contactPhone ?? "" },
    values: student ? { name: student.name, rollNumber: student.rollNumber, class: student.class, section: student.section, contactPhone: student.contactPhone ?? "" } : undefined,
  });

  const onSubmit = (values: StudentForm) => {
    const invalidate = () => qc.invalidateQueries({ queryKey: getListStudentsQueryKey({ schoolId }) });
    const payload = { ...values, schoolId, contactPhone: values.contactPhone ?? "" };
    if (student) {
      update.mutate({ id: student.id, data: payload }, {
        onSuccess: () => { toast.success("Student updated"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to update student"),
      });
    } else {
      create.mutate({ data: payload }, {
        onSuccess: () => { toast.success("Student added"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to add student"),
      });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{student ? "Edit Student" : "Add Student"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl><Input placeholder="Student name" {...field} data-testid="input-student-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-3 gap-3">
              <FormField control={form.control} name="rollNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Roll No.</FormLabel>
                  <FormControl><Input placeholder="001" {...field} data-testid="input-student-roll" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="class" render={({ field }) => (
                <FormItem>
                  <FormLabel>Class</FormLabel>
                  <FormControl><Input placeholder="10" {...field} data-testid="input-student-class" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="section" render={({ field }) => (
                <FormItem>
                  <FormLabel>Section</FormLabel>
                  <FormControl><Input placeholder="A" {...field} data-testid="input-student-section" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="contactPhone" render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Phone (optional)</FormLabel>
                <FormControl><Input placeholder="9876543210" {...field} data-testid="input-student-phone" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-student">
                {isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function BorrowHistorySheet({ student, onClose }: { student: Student; onClose: () => void }) {
  const { data: history, isLoading } = useGetStudentBorrowHistory(student.id, {
    query: { queryKey: getGetStudentBorrowHistoryQueryKey(student.id), enabled: true },
  });

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Borrow History — {student.name}</SheetTitle>
        </SheetHeader>
        {isLoading ? (
          <div className="space-y-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-16 w-full"/>)}</div>
        ) : (
          <div className="space-y-3">
            {(history ?? []).map(r => (
              <div key={r.id} className="rounded-md border border-border p-4" data-testid={`card-history-${r.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{r.bookTitle}</p>
                    <p className="text-xs text-muted-foreground">{r.bookAuthor}</p>
                  </div>
                  {r.status === "issued" && <Badge variant="secondary">Issued</Badge>}
                  {r.status === "overdue" && <Badge variant="destructive">Overdue</Badge>}
                  {r.status === "returned" && <Badge variant="outline">Returned</Badge>}
                </div>
                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                  <span>Issued: {formatDate(r.issueDate)}</span>
                  <span>Due: {formatDate(r.dueDate)}</span>
                  {r.returnDate && <span>Returned: {formatDate(r.returnDate)}</span>}
                  {r.fineAmount > 0 && <span className="text-destructive font-medium">Fine: ₹{r.fineAmount.toFixed(2)}</span>}
                </div>
              </div>
            ))}
            {(history ?? []).length === 0 && (
              <p className="text-center text-muted-foreground py-8">No borrow history</p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function StudentsPage() {
  const { data: profile } = useGetMyProfile();
  const schoolId = profile?.schoolId ?? "";
  const [search, setSearch] = useState("");
  const { data: students, isLoading } = useListStudents({ schoolId, search: search || undefined });
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState<Student | null>(null);
  const [history, setHistory] = useState<Student | null>(null);
  const qc = useQueryClient();
  const deleteStudent = useDeleteStudent();

  const handleDelete = () => {
    if (!deleting) return;
    deleteStudent.mutate({ id: deleting.id }, {
      onSuccess: () => {
        toast.success("Student removed");
        qc.invalidateQueries({ queryKey: getListStudentsQueryKey({ schoolId }) });
        setDeleting(null);
      },
      onError: () => toast.error("Failed to delete student"),
    });
  };

  return (
    <LibrarianLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Students</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage student records</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImporting(true)} data-testid="button-import-students-csv">
              <Upload className="h-4 w-4 mr-2" /> Import CSV
            </Button>
            <Button onClick={() => setAdding(true)} data-testid="button-add-student">
              <Plus className="h-4 w-4 mr-2" /> Add Student
            </Button>
          </div>
        </div>

        <Input
          placeholder="Search by name or roll number..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
          data-testid="input-search-students"
        />

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-11 w-full"/>)}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-5 py-3 font-medium">Name</th>
                    <th className="text-left px-5 py-3 font-medium">Roll No.</th>
                    <th className="text-left px-5 py-3 font-medium">Class</th>
                    <th className="text-left px-5 py-3 font-medium">Phone</th>
                    <th className="text-right px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(students ?? []).map(student => (
                    <tr key={student.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30" data-testid={`row-student-${student.id}`}>
                      <td className="px-5 py-3 font-medium">{student.name}</td>
                      <td className="px-5 py-3 text-muted-foreground">{student.rollNumber}</td>
                      <td className="px-5 py-3 text-muted-foreground">{student.class}-{student.section}</td>
                      <td className="px-5 py-3 text-muted-foreground">{student.contactPhone ?? "—"}</td>
                      <td className="px-5 py-3 flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setHistory(student as Student)} data-testid={`button-history-${student.id}`}>
                          <History className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(student as Student)} data-testid={`button-edit-student-${student.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleting(student as Student)} data-testid={`button-delete-student-${student.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(students ?? []).length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">No students found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {schoolId && (
        <>
          <StudentFormDialog open={adding} schoolId={schoolId} onClose={() => setAdding(false)} />
          {editing && <StudentFormDialog open schoolId={schoolId} student={editing} onClose={() => setEditing(null)} />}
          <StudentsImportDialog open={importing} schoolId={schoolId} onClose={() => setImporting(false)} />
        </>
      )}

      {history && <BorrowHistorySheet student={history} onClose={() => setHistory(null)} />}

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleting?.name}</strong> from the system? All their borrow history will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-delete-student">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LibrarianLayout>
  );
}
