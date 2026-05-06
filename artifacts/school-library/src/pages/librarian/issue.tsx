import { useState } from "react";
import LibrarianLayout from "@/components/layout/librarian-layout";
import { useListStudents, useListBooks, useIssueBook, useGetMyProfile, getListIssuesQueryKey, getListBooksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { BookPlus, Printer, CheckCircle2 } from "lucide-react";

const today = new Date();
const defaultDue = new Date(today);
defaultDue.setDate(defaultDue.getDate() + 14);
const defaultDueStr = defaultDue.toISOString().split("T")[0];

const issueSchema = z.object({
  studentId: z.string().min(1, "Select a student"),
  bookId: z.string().min(1, "Select a book"),
  dueDate: z.string().min(1, "Due date required"),
});

type IssueForm = z.infer<typeof issueSchema>;

type IssueSlip = {
  studentName: string;
  rollNumber: string;
  class: string;
  section: string;
  bookTitle: string;
  bookAuthor: string;
  issueDate: string;
  dueDate: string;
  issuedBy?: string;
};

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function IssueSlipDialog({ slip, onClose }: { slip: IssueSlip; onClose: () => void }) {
  const handlePrint = () => {
    const printContent = document.getElementById("issue-slip-content");
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Book Issue Slip</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; max-width: 480px; margin: 0 auto; }
            h2 { text-align: center; margin-bottom: 4px; }
            p.sub { text-align: center; color: #666; margin-bottom: 24px; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 8px 12px; border: 1px solid #ddd; font-size: 14px; }
            td:first-child { background: #f5f5f5; font-weight: 600; width: 40%; }
            .footer { margin-top: 32px; text-align: center; font-size: 12px; color: #888; }
            .box { border: 2px solid #333; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
          </style>
        </head>
        <body>
          <h2>📚 Library Issue Slip</h2>
          <p class="sub">Issued on ${formatDate(slip.issueDate)}</p>
          <div class="box">
            <table>
              <tr><td>Student Name</td><td>${slip.studentName}</td></tr>
              <tr><td>Roll Number</td><td>${slip.rollNumber}</td></tr>
              <tr><td>Class</td><td>${slip.class} – ${slip.section}</td></tr>
            </table>
          </div>
          <div class="box">
            <table>
              <tr><td>Book Title</td><td>${slip.bookTitle}</td></tr>
              <tr><td>Author</td><td>${slip.bookAuthor}</td></tr>
              <tr><td>Issue Date</td><td>${formatDate(slip.issueDate)}</td></tr>
              <tr><td>Due Date</td><td style="font-weight:bold;color:#c00;">${formatDate(slip.dueDate)}</td></tr>
            </table>
          </div>
          <p class="footer">Please return the book before the due date. Late returns will incur a fine.<br/>— School Library</p>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" /> Book Issued Successfully
          </DialogTitle>
        </DialogHeader>
        <div id="issue-slip-content" className="space-y-4 py-2">
          <div className="rounded-md border border-border overflow-hidden">
            <div className="bg-muted px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Student</div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{slip.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Roll No.</span>
                <span>{slip.rollNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Class</span>
                <span>{slip.class}–{slip.section}</span>
              </div>
            </div>
          </div>
          <div className="rounded-md border border-border overflow-hidden">
            <div className="bg-muted px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Book</div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Title</span>
                <span className="font-medium text-right max-w-[60%]">{slip.bookTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Author</span>
                <span>{slip.bookAuthor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Issue Date</span>
                <span>{formatDate(slip.issueDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span className="font-bold text-destructive">{formatDate(slip.dueDate)}</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-center text-muted-foreground">Please return the book before the due date to avoid fines.</p>
        </div>
        <div className="flex gap-2 justify-end mt-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> Print Slip
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function IssuePage() {
  const { data: profile } = useGetMyProfile();
  const schoolId = profile?.schoolId ?? "";
  const qc = useQueryClient();
  const issueBook = useIssueBook();

  const { data: students } = useListStudents({ schoolId });
  const { data: books } = useListBooks({ schoolId });
  const [studentSearch, setStudentSearch] = useState("");
  const [bookSearch, setBookSearch] = useState("");
  const [issueSlip, setIssueSlip] = useState<IssueSlip | null>(null);

  const filteredStudents = (students ?? []).filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.rollNumber.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const filteredBooks = (books ?? []).filter(b =>
    b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
    b.author.toLowerCase().includes(bookSearch.toLowerCase())
  ).filter(b => b.availableCopies > 0);

  const form = useForm<IssueForm>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      studentId: "",
      bookId: "",
      dueDate: defaultDueStr,
    },
  });

  const onSubmit = (values: IssueForm) => {
    issueBook.mutate({ data: { ...values, schoolId } }, {
      onSuccess: (result) => {
        const student = (students ?? []).find(s => s.id === values.studentId);
        const book = (books ?? []).find(b => b.id === values.bookId);
        setIssueSlip({
          studentName: student?.name ?? (result as any).studentName ?? "",
          rollNumber: student?.rollNumber ?? (result as any).studentRollNumber ?? "",
          class: student?.class ?? (result as any).studentClass ?? "",
          section: student?.section ?? (result as any).studentSection ?? "",
          bookTitle: book?.title ?? (result as any).bookTitle ?? "",
          bookAuthor: book?.author ?? (result as any).bookAuthor ?? "",
          issueDate: (result as any).issueDate ?? new Date().toISOString().split("T")[0],
          dueDate: values.dueDate,
        });
        form.reset({ studentId: "", bookId: "", dueDate: defaultDueStr });
        setStudentSearch("");
        setBookSearch("");
        qc.invalidateQueries({ queryKey: getListIssuesQueryKey({ schoolId }) });
        qc.invalidateQueries({ queryKey: getListBooksQueryKey({ schoolId }) });
      },
      onError: (err: any) => {
        const msg = err?.data?.error ?? err?.message ?? "Failed to issue book";
        toast.error(msg);
      },
    });
  };

  const selectedBook = (books ?? []).find(b => b.id === form.watch("bookId"));
  const selectedStudent = (students ?? []).find(s => s.id === form.watch("studentId"));

  return (
    <LibrarianLayout>
      <div className="p-8 max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Issue Book</h1>
          <p className="text-sm text-muted-foreground mt-1">Select a student and a book to issue</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Search Student</label>
                  <Input
                    placeholder="Search by name or roll number..."
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    data-testid="input-search-student"
                  />
                </div>

                <FormField control={form.control} name="studentId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-student">
                          <SelectValue placeholder="Select student" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredStudents.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} — {s.rollNumber} ({s.class}-{s.section})
                          </SelectItem>
                        ))}
                        {filteredStudents.length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">No students found</div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {selectedStudent && (
                  <div className="rounded-md bg-muted px-4 py-3 text-sm" data-testid="card-selected-student">
                    <span className="font-medium">{selectedStudent.name}</span>
                    <span className="text-muted-foreground ml-2">Class {selectedStudent.class}-{selectedStudent.section} · Roll {selectedStudent.rollNumber}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Search Book</label>
                  <Input
                    placeholder="Search by title or author..."
                    value={bookSearch}
                    onChange={e => setBookSearch(e.target.value)}
                    data-testid="input-search-book"
                  />
                </div>

                <FormField control={form.control} name="bookId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Book</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-book">
                          <SelectValue placeholder="Select available book" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredBooks.map(b => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.title} — {b.author} ({b.availableCopies} available)
                          </SelectItem>
                        ))}
                        {filteredBooks.length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">No available books found</div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {selectedBook && (
                  <div className="rounded-md bg-muted px-4 py-3 text-sm" data-testid="card-selected-book">
                    <span className="font-medium">{selectedBook.title}</span>
                    <span className="text-muted-foreground ml-2">by {selectedBook.author}</span>
                    <span className="ml-2 text-primary">{selectedBook.availableCopies} copies available</span>
                  </div>
                )}

                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} min={today.toISOString().split("T")[0]} data-testid="input-due-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <Button type="submit" className="w-full" disabled={issueBook.isPending} data-testid="button-issue-book">
                  <BookPlus className="h-4 w-4 mr-2" />
                  {issueBook.isPending ? "Issuing..." : "Issue Book"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {issueSlip && (
        <IssueSlipDialog slip={issueSlip} onClose={() => setIssueSlip(null)} />
      )}
    </LibrarianLayout>
  );
}
