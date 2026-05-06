import { Router } from "express";
import { db, schoolsTable, booksTable, studentsTable, issueRecordsTable, profilesTable } from "@workspace/db";
import { eq, and, count, sum, sql } from "drizzle-orm";
import { requireAuth, requireSuperAdmin, requireLibrarian, type AuthRequest } from "../middlewares/requireAuth";

const router = Router();

router.get("/dashboard/super-admin", requireSuperAdmin, async (req: AuthRequest, res) => {
  const [totalSchools] = await db.select({ count: count() }).from(schoolsTable);
  const [totalBooks] = await db.select({ count: count() }).from(booksTable);
  const [totalStudents] = await db.select({ count: count() }).from(studentsTable);
  const [activeIssues] = await db.select({ count: count() }).from(issueRecordsTable).where(eq(issueRecordsTable.status, "issued"));
  const [overdueBooks] = await db.select({ count: count() }).from(issueRecordsTable).where(eq(issueRecordsTable.status, "overdue"));
  const [totalLibrarians] = await db.select({ count: count() }).from(profilesTable).where(eq(profilesTable.role, "librarian_head"));
  const finesResult = await db.select({ total: sum(issueRecordsTable.fineAmount) }).from(issueRecordsTable).where(eq(issueRecordsTable.status, "returned"));

  res.json({
    totalSchools: totalSchools.count,
    totalBooks: totalBooks.count,
    totalStudents: totalStudents.count,
    activeIssues: activeIssues.count,
    overdueBooks: overdueBooks.count,
    totalFinesCollected: parseFloat(finesResult[0]?.total ?? "0"),
    totalLibrarians: totalLibrarians.count,
  });
});

router.get("/dashboard/librarian", requireLibrarian, async (req: AuthRequest, res) => {
  const profile = req.profile!;
  const schoolId = profile.schoolId;

  if (!schoolId) {
    res.status(400).json({ error: "Librarian has no assigned school" });
    return;
  }

  const [school] = await db.select().from(schoolsTable).where(eq(schoolsTable.id, schoolId)).limit(1);
  const [totalBooks] = await db.select({ count: count() }).from(booksTable).where(eq(booksTable.schoolId, schoolId));
  const [totalAvailable] = await db.select({ total: sum(booksTable.availableCopies) }).from(booksTable).where(eq(booksTable.schoolId, schoolId));
  const [totalStudents] = await db.select({ count: count() }).from(studentsTable).where(eq(studentsTable.schoolId, schoolId));
  const [overdueCount] = await db.select({ count: count() }).from(issueRecordsTable).where(and(eq(issueRecordsTable.schoolId, schoolId), eq(issueRecordsTable.status, "overdue")));

  const today = new Date().toISOString().split("T")[0];
  const [issuedToday] = await db.select({ count: count() }).from(issueRecordsTable)
    .where(and(eq(issueRecordsTable.schoolId, schoolId), eq(issueRecordsTable.issueDate, today)));
  const [returnedToday] = await db.select({ count: count() }).from(issueRecordsTable)
    .where(and(eq(issueRecordsTable.schoolId, schoolId), eq(issueRecordsTable.returnDate, today)));

  const finesResult = await db.select({ total: sum(issueRecordsTable.fineAmount) }).from(issueRecordsTable)
    .where(and(eq(issueRecordsTable.schoolId, schoolId), eq(issueRecordsTable.status, "returned")));

  res.json({
    schoolName: school?.name ?? "Unknown",
    totalBooks: totalBooks.count,
    availableBooks: parseInt(totalAvailable[0]?.total ?? "0"),
    issuedToday: issuedToday.count,
    overdueCount: overdueCount.count,
    finesCollected: parseFloat(finesResult[0].total ?? "0"),
    totalStudents: totalStudents.count,
    returnedToday: returnedToday.count,
  });
});

router.get("/dashboard/school-stats", requireSuperAdmin, async (req: AuthRequest, res) => {
  const schools = await db.select().from(schoolsTable);

  const stats = await Promise.all(schools.map(async (school) => {
    const [totalBooks] = await db.select({ count: count() }).from(booksTable).where(eq(booksTable.schoolId, school.id));
    const [totalStudents] = await db.select({ count: count() }).from(studentsTable).where(eq(studentsTable.schoolId, school.id));
    const [activeIssues] = await db.select({ count: count() }).from(issueRecordsTable).where(and(eq(issueRecordsTable.schoolId, school.id), eq(issueRecordsTable.status, "issued")));
    const [overdueCount] = await db.select({ count: count() }).from(issueRecordsTable).where(and(eq(issueRecordsTable.schoolId, school.id), eq(issueRecordsTable.status, "overdue")));
    const finesResult = await db.select({ total: sum(issueRecordsTable.fineAmount) }).from(issueRecordsTable).where(and(eq(issueRecordsTable.schoolId, school.id), eq(issueRecordsTable.status, "returned")));

    return {
      schoolId: school.id,
      schoolName: school.name,
      totalBooks: totalBooks.count,
      totalStudents: totalStudents.count,
      activeIssues: activeIssues.count,
      overdueCount: overdueCount.count,
      finesCollected: parseFloat(finesResult[0].total ?? "0"),
    };
  }));

  res.json(stats);
});

router.get("/dashboard/overdue", requireAuth, async (req: AuthRequest, res) => {
  const { schoolId } = req.query as Record<string, string | undefined>;
  const profile = req.profile;
  const effectiveSchoolId = profile?.role === "librarian_head" ? profile.schoolId ?? undefined : schoolId;

  const today = new Date().toISOString().split("T")[0];

  // Update status to overdue for any issued books past due date
  await db.execute(
    sql`UPDATE issue_records SET status = 'overdue' WHERE status = 'issued' AND due_date < ${today}`
  );

  const conditions = [eq(issueRecordsTable.status, "overdue")];
  if (effectiveSchoolId) conditions.push(eq(issueRecordsTable.schoolId, effectiveSchoolId));

  const records = await db
    .select({
      issue: issueRecordsTable,
      bookTitle: booksTable.title,
      bookAuthor: booksTable.author,
      studentName: studentsTable.name,
      studentRollNumber: studentsTable.rollNumber,
      studentClass: studentsTable.class,
      studentSection: studentsTable.section,
    })
    .from(issueRecordsTable)
    .leftJoin(booksTable, eq(issueRecordsTable.bookId, booksTable.id))
    .leftJoin(studentsTable, eq(issueRecordsTable.studentId, studentsTable.id))
    .where(and(...conditions))
    .orderBy(issueRecordsTable.dueDate);

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
    studentName: r.studentName ?? "",
    studentRollNumber: r.studentRollNumber ?? "",
    studentClass: r.studentClass ?? "",
    studentSection: r.studentSection ?? "",
  })));
});

router.get("/dashboard/recent-activity", requireAuth, async (req: AuthRequest, res) => {
  const { schoolId, limit } = req.query as Record<string, string | undefined>;
  const profile = req.profile;
  const effectiveSchoolId = profile?.role === "librarian_head" ? profile.schoolId ?? undefined : schoolId;
  const resultLimit = parseInt(limit ?? "10");

  const conditions = [];
  if (effectiveSchoolId) conditions.push(eq(issueRecordsTable.schoolId, effectiveSchoolId));

  const records = await db
    .select({
      issue: issueRecordsTable,
      bookTitle: booksTable.title,
      bookAuthor: booksTable.author,
      studentName: studentsTable.name,
      studentRollNumber: studentsTable.rollNumber,
      studentClass: studentsTable.class,
      studentSection: studentsTable.section,
    })
    .from(issueRecordsTable)
    .leftJoin(booksTable, eq(issueRecordsTable.bookId, booksTable.id))
    .leftJoin(studentsTable, eq(issueRecordsTable.studentId, studentsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${issueRecordsTable.createdAt} DESC`)
    .limit(resultLimit);

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
    studentName: r.studentName ?? "",
    studentRollNumber: r.studentRollNumber ?? "",
    studentClass: r.studentClass ?? "",
    studentSection: r.studentSection ?? "",
  })));
});

export default router;
