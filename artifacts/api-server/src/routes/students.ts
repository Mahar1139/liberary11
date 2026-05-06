import { Router } from "express";
import { db, studentsTable, issueRecordsTable, booksTable } from "@workspace/db";
import { eq, and, ilike, or } from "drizzle-orm";
import { requireAuth, requireLibrarian, type AuthRequest } from "../middlewares/requireAuth";
import { CreateStudentBody } from "@workspace/api-zod";

const router = Router();

function studentToJson(s: typeof studentsTable.$inferSelect) {
  return {
    id: s.id,
    schoolId: s.schoolId,
    name: s.name,
    rollNumber: s.rollNumber,
    class: s.class,
    section: s.section,
    contactPhone: s.contactPhone,
  };
}

router.get("/students", requireAuth, async (req: AuthRequest, res) => {
  const { schoolId, search } = req.query as Record<string, string | undefined>;
  const profile = req.profile;
  const effectiveSchoolId = profile?.role === "librarian_head" ? profile.schoolId ?? undefined : schoolId;

  const conditions = [];
  if (effectiveSchoolId) conditions.push(eq(studentsTable.schoolId, effectiveSchoolId));
  if (search) conditions.push(or(ilike(studentsTable.name, `%${search}%`), ilike(studentsTable.rollNumber, `%${search}%`)));

  const students = conditions.length > 0
    ? await db.select().from(studentsTable).where(and(...conditions))
    : await db.select().from(studentsTable);

  res.json(students.map(studentToJson));
});

router.get("/students/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const students = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
  if (students.length === 0) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  res.json(studentToJson(students[0]));
});

router.get("/students/:id/history", requireAuth, async (req, res) => {
  const { id } = req.params;
  const records = await db
    .select({
      issue: issueRecordsTable,
      bookTitle: booksTable.title,
      bookAuthor: booksTable.author,
    })
    .from(issueRecordsTable)
    .leftJoin(booksTable, eq(issueRecordsTable.bookId, booksTable.id))
    .where(eq(issueRecordsTable.studentId, id))
    .orderBy(issueRecordsTable.createdAt);

  const students = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
  const student = students[0];

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
    status: r.issue.status,
    bookTitle: r.bookTitle ?? "",
    bookAuthor: r.bookAuthor ?? "",
    studentName: student?.name ?? "",
    studentRollNumber: student?.rollNumber ?? "",
    studentClass: student?.class ?? "",
    studentSection: student?.section ?? "",
  })));
});

router.post("/students", requireLibrarian, async (req: AuthRequest, res) => {
  const parsed = CreateStudentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [student] = await db.insert(studentsTable).values(parsed.data).returning();
  res.status(201).json(studentToJson(student));
});

router.put("/students/:id", requireLibrarian, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const parsed = CreateStudentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [student] = await db.update(studentsTable).set(parsed.data).where(eq(studentsTable.id, id)).returning();
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  res.json(studentToJson(student));
});

router.delete("/students/:id", requireLibrarian, async (req: AuthRequest, res) => {
  const { id } = req.params;
  await db.delete(studentsTable).where(eq(studentsTable.id, id));
  res.json({ message: "Student deleted" });
});

router.post("/students/bulk", requireLibrarian, async (req: AuthRequest, res) => {
  const BulkStudentRow = CreateStudentBody;
  const parsed = BulkStudentRow.array().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  if (parsed.data.length === 0) {
    res.status(400).json({ error: "No rows to import" });
    return;
  }
  const inserted = await db.insert(studentsTable).values(parsed.data).returning();
  res.status(201).json({ count: inserted.length, students: inserted.map(studentToJson) });
});

export default router;
