import { useState, useRef } from "react";
import LibrarianLayout from "@/components/layout/librarian-layout";
import { useListBooks, useCreateBook, useUpdateBook, useDeleteBook, useGetMyProfile, getListBooksQueryKey } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Upload, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const CATEGORIES = ["Fiction", "Non-Fiction", "Textbook", "Reference", "Biography", "History", "Science", "Other"];

const bookSchema = z.object({
  title: z.string().min(1, "Title required"),
  author: z.string().min(1, "Author required"),
  isbn: z.string().optional(),
  category: z.string().min(1, "Category required"),
  totalCopies: z.coerce.number().min(1, "At least 1 copy"),
  availableCopies: z.coerce.number().min(0),
  coverImageUrl: z.string().optional(),
});

type BookForm = z.infer<typeof bookSchema>;
type Book = { id: string; schoolId: string; title: string; author: string; isbn?: string | null; category: string; totalCopies: number; availableCopies: number };

const BOOK_CSV_HEADERS = ["title", "author", "isbn", "category", "totalCopies", "availableCopies"];
const BOOK_CSV_SAMPLE = `title,author,isbn,category,totalCopies,availableCopies
The Great Gatsby,F. Scott Fitzgerald,978-0743273565,Fiction,5,5
Introduction to Algorithms,Thomas H. Cormen,978-0262033848,Textbook,3,2
A Brief History of Time,Stephen Hawking,978-0553380163,Science,4,4`;

type ParsedBookRow = {
  title: string;
  author: string;
  isbn: string;
  category: string;
  totalCopies: number;
  availableCopies: number;
  schoolId: string;
  error?: string;
};

function parseBooksCsv(csv: string, schoolId: string): ParsedBookRow[] {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map(h => h.trim().toLowerCase());
  const idx = (col: string) => header.indexOf(col);

  return lines.slice(1).map((line, i) => {
    const cols = line.split(",").map(c => c.trim());
    const title = cols[idx("title")] ?? "";
    const author = cols[idx("author")] ?? "";
    const isbn = cols[idx("isbn")] ?? "";
    const category = cols[idx("category")] ?? "";
    const totalCopies = parseInt(cols[idx("totalcopies")] ?? "0", 10);
    const availableCopies = parseInt(cols[idx("availablecopies")] ?? "0", 10);

    const errors: string[] = [];
    if (!title) errors.push("title missing");
    if (!author) errors.push("author missing");
    if (!category) errors.push("category missing");
    if (isNaN(totalCopies) || totalCopies < 1) errors.push("totalCopies must be ≥1");
    if (isNaN(availableCopies) || availableCopies < 0) errors.push("availableCopies must be ≥0");

    return { title, author, isbn, category, totalCopies, availableCopies, schoolId, error: errors.length ? errors.join(", ") : undefined };
  });
}

function downloadSampleCsv() {
  const blob = new Blob([BOOK_CSV_SAMPLE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sample_books.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function BooksImportDialog({ open, schoolId, onClose }: { open: boolean; schoolId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedBookRow[]>([]);
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
      setRows(parseBooksCsv(text, schoolId));
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setLoading(true);
    try {
      const payload = validRows.map(r => ({
        title: r.title,
        author: r.author,
        isbn: r.isbn,
        category: r.category,
        totalCopies: r.totalCopies,
        availableCopies: r.availableCopies,
        schoolId: r.schoolId,
      }));
      await customFetch("/api/books/bulk", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      toast.success(`${validRows.length} book(s) imported successfully`);
      qc.invalidateQueries({ queryKey: getListBooksQueryKey({ schoolId }) });
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
          <DialogTitle>Import Books from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: <code className="text-xs bg-muted px-1 py-0.5 rounded">title, author, isbn, category, totalCopies, availableCopies</code>
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
                    <th className="text-left px-3 py-2 font-medium">Title</th>
                    <th className="text-left px-3 py-2 font-medium">Author</th>
                    <th className="text-left px-3 py-2 font-medium">Category</th>
                    <th className="text-left px-3 py-2 font-medium">ISBN</th>
                    <th className="text-right px-3 py-2 font-medium">Copies</th>
                    <th className="text-right px-3 py-2 font-medium">Avail.</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={`border-b border-border/50 last:border-0 ${r.error ? "bg-destructive/5" : ""}`}>
                      <td className="px-3 py-2 font-medium">{r.title || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.author || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.category || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.isbn || "—"}</td>
                      <td className="px-3 py-2 text-right">{r.totalCopies}</td>
                      <td className="px-3 py-2 text-right">{r.availableCopies}</td>
                      <td className="px-3 py-2">
                        {r.error
                          ? <span className="text-destructive text-xs">{r.error}</span>
                          : <span className="text-green-600 text-xs">OK</span>}
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
              <p className="text-xs opacity-70">Headers: title, author, isbn, category, totalCopies, availableCopies</p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleImport} disabled={validRows.length === 0 || loading}>
            {loading ? "Importing..." : `Import ${validRows.length > 0 ? validRows.length + " Books" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BookFormDialog({ open, book, schoolId, onClose }: { open: boolean; book?: Book | null; schoolId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const create = useCreateBook();
  const update = useUpdateBook();

  const form = useForm<BookForm>({
    resolver: zodResolver(bookSchema),
    defaultValues: {
      title: book?.title ?? "",
      author: book?.author ?? "",
      isbn: book?.isbn ?? "",
      category: book?.category ?? "Fiction",
      totalCopies: book?.totalCopies ?? 1,
      availableCopies: book?.availableCopies ?? 1,
      coverImageUrl: "",
    },
    values: book ? {
      title: book.title,
      author: book.author,
      isbn: book.isbn ?? "",
      category: book.category,
      totalCopies: book.totalCopies,
      availableCopies: book.availableCopies,
      coverImageUrl: "",
    } : undefined,
  });

  const onSubmit = (values: BookForm) => {
    const invalidate = () => qc.invalidateQueries({ queryKey: getListBooksQueryKey({ schoolId }) });
    const payload = { ...values, schoolId, isbn: values.isbn ?? "" };
    if (book) {
      update.mutate({ id: book.id, data: payload }, {
        onSuccess: () => { toast.success("Book updated"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to update book"),
      });
    } else {
      create.mutate({ data: payload }, {
        onSuccess: () => { toast.success("Book added"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to add book"),
      });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{book ? "Edit Book" : "Add Book"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input placeholder="Book title" {...field} data-testid="input-book-title" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="author" render={({ field }) => (
                <FormItem>
                  <FormLabel>Author</FormLabel>
                  <FormControl><Input placeholder="Author name" {...field} data-testid="input-book-author" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="isbn" render={({ field }) => (
                <FormItem>
                  <FormLabel>ISBN (optional)</FormLabel>
                  <FormControl><Input placeholder="978-..." {...field} data-testid="input-book-isbn" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger data-testid="select-book-category"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="totalCopies" render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Copies</FormLabel>
                  <FormControl><Input type="number" min={1} {...field} data-testid="input-book-total-copies" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="availableCopies" render={({ field }) => (
                <FormItem>
                  <FormLabel>Available Copies</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} data-testid="input-book-available-copies" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-book">
                {isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function BooksPage() {
  const { data: profile } = useGetMyProfile();
  const schoolId = profile?.schoolId ?? "";
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("_all");
  const { data: books, isLoading } = useListBooks({ schoolId, search: search || undefined, category: category === "_all" ? undefined : category || undefined });
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState<Book | null>(null);
  const qc = useQueryClient();
  const deleteBook = useDeleteBook();

  const handleDelete = () => {
    if (!deleting) return;
    deleteBook.mutate({ id: deleting.id }, {
      onSuccess: () => {
        toast.success("Book deleted");
        qc.invalidateQueries({ queryKey: getListBooksQueryKey({ schoolId }) });
        setDeleting(null);
      },
      onError: () => toast.error("Failed to delete book"),
    });
  };

  return (
    <LibrarianLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Books</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage the book catalog</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImporting(true)} data-testid="button-import-books-csv">
              <Upload className="h-4 w-4 mr-2" /> Import CSV
            </Button>
            <Button onClick={() => setAdding(true)} data-testid="button-add-book">
              <Plus className="h-4 w-4 mr-2" /> Add Book
            </Button>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Input
            placeholder="Search by title or author..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs"
            data-testid="input-search-books"
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40" data-testid="select-filter-category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-11 w-full"/>)}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-5 py-3 font-medium">Title</th>
                    <th className="text-left px-5 py-3 font-medium">Author</th>
                    <th className="text-left px-5 py-3 font-medium">Category</th>
                    <th className="text-left px-5 py-3 font-medium">ISBN</th>
                    <th className="text-right px-5 py-3 font-medium">Copies</th>
                    <th className="text-right px-5 py-3 font-medium">Available</th>
                    <th className="text-right px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(books ?? []).map(book => (
                    <tr key={book.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30" data-testid={`row-book-${book.id}`}>
                      <td className="px-5 py-3 font-medium">{book.title}</td>
                      <td className="px-5 py-3 text-muted-foreground">{book.author}</td>
                      <td className="px-5 py-3"><Badge variant="outline">{book.category}</Badge></td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">{book.isbn ?? "—"}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{book.totalCopies}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={book.availableCopies === 0 ? "text-destructive font-medium" : "text-foreground"}>
                          {book.availableCopies}
                        </span>
                      </td>
                      <td className="px-5 py-3 flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(book as Book)} data-testid={`button-edit-book-${book.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleting(book as Book)} data-testid={`button-delete-book-${book.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(books ?? []).length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">No books found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {schoolId && (
        <>
          <BookFormDialog open={adding} schoolId={schoolId} onClose={() => setAdding(false)} />
          {editing && <BookFormDialog open={true} schoolId={schoolId} book={editing} onClose={() => setEditing(null)} />}
          <BooksImportDialog open={importing} schoolId={schoolId} onClose={() => setImporting(false)} />
        </>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Book</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleting?.title}</strong> from the catalog? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-delete-book">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LibrarianLayout>
  );
}
