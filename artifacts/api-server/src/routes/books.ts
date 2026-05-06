import { Router } from "express";
import { db, booksTable } from "@workspace/db";
import { eq, and, ilike, or } from "drizzle-orm";
import { requireAuth, requireLibrarian, type AuthRequest } from "../middlewares/requireAuth";
import { CreateBookBody } from "@workspace/api-zod";

const router = Router();

function bookToJson(b: typeof booksTable.$inferSelect) {
  return {
    id: b.id,
    schoolId: b.schoolId,
    title: b.title,
    author: b.author,
    isbn: b.isbn,
    category: b.category,
    totalCopies: b.totalCopies,
    availableCopies: b.availableCopies,
    coverImageUrl: b.coverImageUrl ?? null,
    createdAt: b.createdAt.toISOString(),
  };
}

router.get("/books", requireAuth, async (req: AuthRequest, res) => {
  const { schoolId, search, category } = req.query as Record<string, string | undefined>;
  const profile = req.profile;

  // Librarians can only see their school's books
  const effectiveSchoolId = profile?.role === "librarian_head" ? profile.schoolId ?? undefined : schoolId;

  const conditions = [];
  if (effectiveSchoolId) conditions.push(eq(booksTable.schoolId, effectiveSchoolId));
  if (search) conditions.push(or(ilike(booksTable.title, `%${search}%`), ilike(booksTable.author, `%${search}%`), ilike(booksTable.isbn, `%${search}%`)));
  if (category) conditions.push(eq(booksTable.category, category));

  const books = conditions.length > 0
    ? await db.select().from(booksTable).where(and(...conditions)).orderBy(booksTable.createdAt)
    : await db.select().from(booksTable).orderBy(booksTable.createdAt);

  res.json(books.map(bookToJson));
});

router.get("/books/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const books = await db.select().from(booksTable).where(eq(booksTable.id, id)).limit(1);
  if (books.length === 0) {
    res.status(404).json({ error: "Book not found" });
    return;
  }
  res.json(bookToJson(books[0]));
});

router.post("/books", requireLibrarian, async (req: AuthRequest, res) => {
  const parsed = CreateBookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [book] = await db.insert(booksTable).values(parsed.data).returning();
  res.status(201).json(bookToJson(book));
});

router.put("/books/:id", requireLibrarian, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const parsed = CreateBookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [book] = await db.update(booksTable).set(parsed.data).where(eq(booksTable.id, id)).returning();
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }
  res.json(bookToJson(book));
});

router.delete("/books/:id", requireLibrarian, async (req: AuthRequest, res) => {
  const { id } = req.params;
  await db.delete(booksTable).where(eq(booksTable.id, id));
  res.json({ message: "Book deleted" });
});

router.post("/books/bulk", requireLibrarian, async (req: AuthRequest, res) => {
  const BulkBookRow = CreateBookBody;
  const parsed = BulkBookRow.array().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  if (parsed.data.length === 0) {
    res.status(400).json({ error: "No rows to import" });
    return;
  }
  const inserted = await db.insert(booksTable).values(parsed.data).returning();
  res.status(201).json({ count: inserted.length, books: inserted.map(bookToJson) });
});

export default router;
