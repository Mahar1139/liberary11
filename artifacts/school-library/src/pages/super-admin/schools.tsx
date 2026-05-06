import { useState } from "react";
import SuperAdminLayout from "@/components/layout/super-admin-layout";
import { useListSchools, useDeleteSchool, getListSchoolsQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const schoolSchema = z.object({
  name: z.string().min(2, "Name is required"),
  address: z.string().min(2, "Address is required"),
  contactEmail: z.string().email("Valid email required"),
  fineRatePerDay: z.coerce.number().min(0, "Cannot be negative").default(2),
});

type SchoolForm = z.infer<typeof schoolSchema>;
type School = { id: string; name: string; address: string; contactEmail: string; fineRatePerDay?: number; createdAt: string };

function SchoolFormDialog({
  open,
  school,
  onClose,
}: {
  open: boolean;
  school?: School | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const form = useForm<SchoolForm>({
    resolver: zodResolver(schoolSchema),
    defaultValues: {
      name: school?.name ?? "",
      address: school?.address ?? "",
      contactEmail: school?.contactEmail ?? "",
      fineRatePerDay: school?.fineRatePerDay ?? 2,
    },
    values: {
      name: school?.name ?? "",
      address: school?.address ?? "",
      contactEmail: school?.contactEmail ?? "",
      fineRatePerDay: school?.fineRatePerDay ?? 2,
    },
  });

  const onSubmit = async (values: SchoolForm) => {
    setLoading(true);
    try {
      const payload = {
        name: values.name,
        address: values.address,
        contactEmail: values.contactEmail,
        fineRatePerDay: values.fineRatePerDay,
      };
      if (school) {
        await customFetch(`/api/schools/${school.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
        });
        toast.success("School updated");
      } else {
        await customFetch(`/api/schools`, {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
        });
        toast.success("School created");
      }
      qc.invalidateQueries({ queryKey: getListSchoolsQueryKey() });
      onClose();
    } catch {
      toast.error(school ? "Failed to update school" : "Failed to create school");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{school ? "Edit School" : "Add School"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>School Name</FormLabel>
                <FormControl><Input placeholder="Delhi Public School" {...field} data-testid="input-school-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl><Input placeholder="15 Ring Road, New Delhi" {...field} data-testid="input-school-address" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="contactEmail" render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Email</FormLabel>
                <FormControl><Input type="email" placeholder="info@school.edu.in" {...field} data-testid="input-school-email" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="fineRatePerDay" render={({ field }) => (
              <FormItem>
                <FormLabel>Fine Rate (₹ per day overdue)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                    <Input type="number" min={0} step={0.5} className="pl-7" placeholder="2" {...field} data-testid="input-school-fine-rate" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={loading} data-testid="button-save-school">
                {loading ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function SchoolsPage() {
  const { data: schools, isLoading } = useListSchools();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<School | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<School | null>(null);
  const qc = useQueryClient();
  const deleteSchool = useDeleteSchool();

  const filtered = ((schools ?? []) as School[]).filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.address.toLowerCase().includes(search.toLowerCase()) ||
    s.contactEmail.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = () => {
    if (!deleting) return;
    deleteSchool.mutate({ id: deleting.id }, {
      onSuccess: () => {
        toast.success("School deleted");
        qc.invalidateQueries({ queryKey: getListSchoolsQueryKey() });
        setDeleting(null);
      },
      onError: () => toast.error("Failed to delete school"),
    });
  };

  return (
    <SuperAdminLayout>
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Schools</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage all registered schools</p>
          </div>
          <Button onClick={() => setAdding(true)} data-testid="button-add-school">
            <Plus className="h-4 w-4 mr-2" /> Add School
          </Button>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Search schools..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-sm"
            data-testid="input-search-schools"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-6 py-3 font-medium">School Name</th>
                    <th className="text-left px-6 py-3 font-medium">Address</th>
                    <th className="text-left px-6 py-3 font-medium">Email</th>
                    <th className="text-right px-6 py-3 font-medium">Fine Rate</th>
                    <th className="text-right px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((school) => (
                    <tr key={school.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30" data-testid={`row-school-${school.id}`}>
                      <td className="px-6 py-3 font-medium">{school.name}</td>
                      <td className="px-6 py-3 text-muted-foreground">{school.address}</td>
                      <td className="px-6 py-3 text-muted-foreground">{school.contactEmail}</td>
                      <td className="px-6 py-3 text-right text-muted-foreground">₹{(school.fineRatePerDay ?? 2).toFixed(2)}/day</td>
                      <td className="px-6 py-3 flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(school)} data-testid={`button-edit-school-${school.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleting(school)} data-testid={`button-delete-school-${school.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">No schools found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <SchoolFormDialog open={adding} onClose={() => setAdding(false)} />
      <SchoolFormDialog open={!!editing} school={editing} onClose={() => setEditing(null)} />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete School</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleting?.name}</strong> and all its data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete-school">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SuperAdminLayout>
  );
}
