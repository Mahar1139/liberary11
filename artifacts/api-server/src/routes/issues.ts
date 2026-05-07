import { Router } from "express";
import { db, issueRecordsTable, booksTable, studentsTable, schoolsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireLibrarian, type AuthRequest } from "../middlewares/requireAuth";
import { IssueBookBody } from "@workspace/api-zod";
import { z } from "zod";

const router = Router();

async function issueToJson(record: typeof issueRecordsTable.$inferSelect) {
  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, record.bookId)).limit(1);
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, record.studentId)).limit(1);
  return {
    id: record.id,
    schoolId: record.schoolId,
    bookId: record.bookId,
    studentId: record.studentId,
    issuedBy: record.issuedBy,
    issueDate: record.issueDate,
    dueDate: record.dueDate,
    returnDate: record.returnDate ?? null,
    fineAmount: parseFloat(record.fineAmount),
    finePaid: record.finePaid,
    status: record.status,
    bookTitle: book?.title ?? "",
    bookAuthor: book?.author ?? "",
    studentName: student?.name ?? "",
    studentRollNumber: student?.rollNumber ?? "",
    studentClass: student?.class ?? "",
    studentSection: student?.section ?? "",
    studentPhone: student?.contactPhone ?? "",
  };
}

router.get("/issues", requireAuth, async (req: AuthRequest, res) => {
  const { schoolId, status, studentId } = req.query as Record<string, string | undefined>;
  const profile = req.profile;
  const effectiveSchoolId = profile?.role === "librarian_head" ? profile.schoolId ?? undefined : schoolId;

  const conditions = [];
  if (effectiveSchoolId) conditions.push(eq(issueRecordsTable.schoolId, effectiveSchoolId));
  if (status && ["issued", "returned", "overdue"].includes(status)) {
    conditions.push(eq(issueRecordsTable.status, status as "issued" | "returned" | "overdue"));
  }
  if (studentId) conditions.push(eq(issueRecordsTable.studentId, studentId));

  const records = await db
    .select({
      issue: issueRecordsTable,
      bookTitle: booksTable.title,
      bookAuthor: booksTable.author,
      studentName: studentsTable.name,
      studentRollNumber: studentsTable.rollNumber,
      studentClass: studentsTable.class,
      studentSection: studentsTable.section,
      studentPhone: studentsTable.contactPhone,
    })
    .from(issueRecordsTable)
    .leftJoin(booksTable, eq(issueRecordsTable.bookId, booksTable.id))
    .leftJoin(studentsTable, eq(issueRecordsTable.studentId, studentsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(issueRecordsTable.createdAt);

  res.json(records.map(r => ({
    id: r.issue.id,
    schoolId: r.issue.schoolId,
    bookId: r.issue.bookId,
    studentId: r.issue.studentId,
    issuedBy: r.issue.issuedBy,
    issueDate: r.issue.issueDate,
    dueDate: r.issue.dueDate,
    returnDate: r.issue.returnDate ?? null,
    fineAmount: parseFloat(r.issue.fineAmount),
    finePaid: r.issue.finePaid,
    status: r.issue.status,
    bookTitle: r.bookTitle ?? "",
    bookAuthor: r.bookAuthor ?? "",
    studentName: r.studentName ?? "",
    studentRollNumber: r.studentRollNumber ?? "",
    studentClass: r.studentClass ?? "",
    studentSection: r.studentSection ?? "",
    studentPhone: r.studentPhone ?? "",
  })));
});

router.post("/issues", requireLibrarian, async (req: AuthRequest, res) => {
  const parsed = IssueBookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const profile = req.profile!;
  const { schoolId, bookId, studentId, dueDate } = parsed.data;

  // Check book availability
  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, bookId)).limit(1);
  if (!book || book.availableCopies <= 0) {
    res.status(400).json({ error: "Book not available" });
    return;
  }

  // #2 - Duplicate issue check: student already has this book active
  const existing = await db
    .select()
    .from(issueRecordsTable)
    .where(
      and(
        eq(issueRecordsTable.studentId, studentId),
        eq(issueRecordsTable.bookId, bookId),
      )
    )
    .limit(10);

  const activeIssue = existing.find(r => r.status === "issued" || r.status === "overdue");
  if (activeIssue) {
    res.status(400).json({ error: "This student already has an active issue for this book" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  const [record] = await db.insert(issueRecordsTable).values({
    schoolId,
    bookId,
    studentId,
    issuedBy: profile.id,
    issueDate: today,
    dueDate,
    status: "issued",
    fineAmount: "0",
    finePaid: false,
  }).returning();

  await db.update(booksTable)
    .set({ availableCopies: book.availableCopies - 1 })
    .where(eq(booksTable.id, bookId));

  res.status(201).json(await issueToJson(record));
});

router.post("/issues/:id/return", requireLibrarian, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const [record] = await db.select().from(issueRecordsTable).where(eq(issueRecordsTable.id, id)).limit(1);
  if (!record) {
    res.status(404).json({ error: "Issue record not found" });
    return;
  }
  if (record.status === "returned") {
    res.status(400).json({ error: "Book already returned" });
    return;
  }

  // #3 - Use school's fine rate per day
  const [school] = await db.select().from(schoolsTable).where(eq(schoolsTable.id, record.schoolId)).limit(1);
  const fineRatePerDay = parseFloat(school?.fineRatePerDay ?? "2.00");

  const today = new Date().toISOString().split("T")[0];
  const dueDate = new Date(record.dueDate);
  const returnDate = new Date(today);

  let fineAmount = 0;
  if (returnDate > dueDate) {
    const diffMs = returnDate.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    fineAmount = diffDays * fineRatePerDay;
  }

  const [updated] = await db.update(issueRecordsTable)
    .set({ returnDate: today, status: "returned", fineAmount: fineAmount.toString(), finePaid: fineAmount === 0 })
    .where(eq(issueRecordsTable.id, id))
    .returning();

  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, record.bookId)).limit(1);
  if (book) {
    await db.update(booksTable)
      .set({ availableCopies: book.availableCopies + 1 })
      .where(eq(booksTable.id, record.bookId));
  }

  res.json(await issueToJson(updated));
});

// #5 - Book renewal endpoint
router.post("/issues/:id/renew", requireLibrarian, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const parsed = z.object({ dueDate: z.string().min(1, "Due date required") }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid due date" });
    return;
  }

  const [record] = await db.select().from(issueRecordsTable).where(eq(issueRecordsTable.id, id)).limit(1);
  if (!record) {
    res.status(404).json({ error: "Issue record not found" });
    return;
  }
  if (record.status === "returned") {
    res.status(400).json({ error: "Cannot renew a returned book" });
    return;
  }

  const newDueDate = parsed.data.dueDate;
  const today = new Date().toISOString().split("T")[0];
  if (newDueDate <= today) {
    res.status(400).json({ error: "New due date must be in the future" });
    return;
  }

  const [updated] = await db.update(issueRecordsTable)
    .set({ dueDate: newDueDate, status: "issued", fineAmount: "0" })
    .where(eq(issueRecordsTable.id, id))
    .returning();

  res.json(await issueToJson(updated));
});

// Set manual fine for an issued/overdue book
router.post("/issues/:id/set-fine", requireLibrarian, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const parsed = z.object({ fineAmount: z.coerce.number().min(0) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid fine amount" });
    return;
  }
  const [record] = await db.select().from(issueRecordsTable).where(eq(issueRecordsTable.id, id)).limit(1);
  if (!record) {
    res.status(404).json({ error: "Issue record not found" });
    return;
  }
  if (record.status === "returned") {
    res.status(400).json({ error: "Cannot set fine on a returned book — use mark-fine-paid instead" });
    return;
  }
  const [updated] = await db.update(issueRecordsTable)
    .set({ fineAmount: parsed.data.fineAmount.toString(), finePaid: false })
    .where(eq(issueRecordsTable.id, id))
    .returning();
  res.json(await issueToJson(updated));
});

// #8 - Mark fine as paid
router.post("/issues/:id/mark-fine-paid", requireLibrarian, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const [record] = await db.select().from(issueRecordsTable).where(eq(issueRecordsTable.id, id)).limit(1);
  if (!record) {
    res.status(404).json({ error: "Issue record not found" });
    return;
  }
  if (record.status !== "returned") {
    res.status(400).json({ error: "Fine can only be marked paid for returned books" });
    return;
  }
  if (record.finePaid) {
    res.status(400).json({ error: "Fine already marked as paid" });
    return;
  }

  const [updated] = await db.update(issueRecordsTable)
    .set({ finePaid: true })
    .where(eq(issueRecordsTable.id, id))
    .returning();

  res.json(await issueToJson(updated));
});

router.delete("/issues/:id", requireLibrarian, async (req: AuthRequest, res) => {
  const { id } = req.params;
  await db.delete(issueRecordsTable).where(eq(issueRecordsTable.id, id));
  res.json({ message: "Issue record deleted" });
});

export default router;
