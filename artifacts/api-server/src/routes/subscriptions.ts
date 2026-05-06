import { Router } from "express";
import { db, schoolsTable, subscriptionPaymentsTable, profilesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireSuperAdmin, requireLibrarian, type AuthRequest } from "../middlewares/requireAuth";
import { z } from "zod";

const router = Router();

// Super admin: get all schools with subscription info
router.get("/subscriptions", requireSuperAdmin, async (req: AuthRequest, res) => {
  const schools = await db.select().from(schoolsTable).orderBy(schoolsTable.name);

  const result = await Promise.all(schools.map(async (school) => {
    const payments = await db
      .select()
      .from(subscriptionPaymentsTable)
      .where(eq(subscriptionPaymentsTable.schoolId, school.id))
      .orderBy(desc(subscriptionPaymentsTable.submittedAt))
      .limit(1);

    const pendingCount = await db
      .select()
      .from(subscriptionPaymentsTable)
      .where(and(
        eq(subscriptionPaymentsTable.schoolId, school.id),
        eq(subscriptionPaymentsTable.status, "pending")
      ));

    return {
      id: school.id,
      name: school.name,
      contactEmail: school.contactEmail,
      status: school.status,
      monthlyFee: parseFloat(school.monthlyFee),
      lastPayment: payments[0] ? {
        id: payments[0].id,
        amount: parseFloat(payments[0].amount),
        month: payments[0].month,
        year: payments[0].year,
        status: payments[0].status,
        submittedAt: payments[0].submittedAt.toISOString(),
      } : null,
      pendingPayments: pendingCount.length,
    };
  }));

  res.json(result);
});

// Super admin: get all pending payments
router.get("/subscriptions/pending", requireSuperAdmin, async (req: AuthRequest, res) => {
  const payments = await db
    .select({
      payment: subscriptionPaymentsTable,
      schoolName: schoolsTable.name,
      schoolStatus: schoolsTable.status,
    })
    .from(subscriptionPaymentsTable)
    .leftJoin(schoolsTable, eq(subscriptionPaymentsTable.schoolId, schoolsTable.id))
    .where(eq(subscriptionPaymentsTable.status, "pending"))
    .orderBy(desc(subscriptionPaymentsTable.submittedAt));

  res.json(payments.map(p => ({
    id: p.payment.id,
    schoolId: p.payment.schoolId,
    schoolName: p.schoolName ?? "",
    schoolStatus: p.schoolStatus ?? "active",
    amount: parseFloat(p.payment.amount),
    paymentReference: p.payment.paymentReference,
    notes: p.payment.notes ?? "",
    month: p.payment.month,
    year: p.payment.year,
    status: p.payment.status,
    submittedAt: p.payment.submittedAt.toISOString(),
  })));
});

// Super admin: get all payments
router.get("/subscriptions/all", requireSuperAdmin, async (req: AuthRequest, res) => {
  const payments = await db
    .select({
      payment: subscriptionPaymentsTable,
      schoolName: schoolsTable.name,
    })
    .from(subscriptionPaymentsTable)
    .leftJoin(schoolsTable, eq(subscriptionPaymentsTable.schoolId, schoolsTable.id))
    .orderBy(desc(subscriptionPaymentsTable.submittedAt));

  res.json(payments.map(p => ({
    id: p.payment.id,
    schoolId: p.payment.schoolId,
    schoolName: p.schoolName ?? "",
    amount: parseFloat(p.payment.amount),
    paymentReference: p.payment.paymentReference,
    notes: p.payment.notes ?? "",
    month: p.payment.month,
    year: p.payment.year,
    status: p.payment.status,
    submittedAt: p.payment.submittedAt.toISOString(),
    reviewedAt: p.payment.reviewedAt?.toISOString() ?? null,
  })));
});

// Librarian: get own school's payment history
router.get("/subscriptions/my", requireAuth, async (req: AuthRequest, res) => {
  const profile = req.profile;
  if (!profile?.schoolId) {
    res.status(400).json({ error: "No school assigned" });
    return;
  }

  const payments = await db
    .select()
    .from(subscriptionPaymentsTable)
    .where(eq(subscriptionPaymentsTable.schoolId, profile.schoolId))
    .orderBy(desc(subscriptionPaymentsTable.submittedAt));

  res.json(payments.map(p => ({
    id: p.id,
    amount: parseFloat(p.amount),
    paymentReference: p.paymentReference,
    notes: p.notes ?? "",
    month: p.month,
    year: p.year,
    status: p.status,
    submittedAt: p.submittedAt.toISOString(),
    reviewedAt: p.reviewedAt?.toISOString() ?? null,
  })));
});

// Librarian: submit payment
router.post("/subscriptions/submit", requireLibrarian, async (req: AuthRequest, res) => {
  const parsed = z.object({
    amount: z.number().min(1),
    paymentReference: z.string().min(1, "Payment reference required"),
    notes: z.string().optional(),
    month: z.string().min(1),
    year: z.string().min(4),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const profile = req.profile!;
  if (!profile.schoolId) {
    res.status(400).json({ error: "No school assigned to this profile" });
    return;
  }

  // Check for duplicate pending payment for same month/year
  const existing = await db
    .select()
    .from(subscriptionPaymentsTable)
    .where(and(
      eq(subscriptionPaymentsTable.schoolId, profile.schoolId),
      eq(subscriptionPaymentsTable.month, parsed.data.month),
      eq(subscriptionPaymentsTable.year, parsed.data.year),
      eq(subscriptionPaymentsTable.status, "pending"),
    ))
    .limit(1);

  if (existing.length > 0) {
    res.status(400).json({ error: "A pending payment already exists for this month" });
    return;
  }

  const [payment] = await db.insert(subscriptionPaymentsTable).values({
    schoolId: profile.schoolId,
    amount: parsed.data.amount.toString(),
    paymentReference: parsed.data.paymentReference,
    notes: parsed.data.notes ?? null,
    month: parsed.data.month,
    year: parsed.data.year,
    status: "pending",
    submittedBy: profile.id,
  }).returning();

  res.status(201).json({
    id: payment.id,
    amount: parseFloat(payment.amount),
    paymentReference: payment.paymentReference,
    notes: payment.notes ?? "",
    month: payment.month,
    year: payment.year,
    status: payment.status,
    submittedAt: payment.submittedAt.toISOString(),
  });
});

// Super admin: approve payment — auto-unfreezes school
router.post("/subscriptions/:id/approve", requireSuperAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const profile = req.profile!;

  const [payment] = await db
    .select()
    .from(subscriptionPaymentsTable)
    .where(eq(subscriptionPaymentsTable.id, id))
    .limit(1);

  if (!payment) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  await db.update(subscriptionPaymentsTable).set({
    status: "approved",
    reviewedBy: profile.id,
    reviewedAt: new Date(),
  }).where(eq(subscriptionPaymentsTable.id, id));

  // Auto-unfreeze the school when payment is approved
  await db.update(schoolsTable).set({ status: "active" }).where(eq(schoolsTable.id, payment.schoolId));

  res.json({ message: "Payment approved and school account activated" });
});

// Super admin: reject payment
router.post("/subscriptions/:id/reject", requireSuperAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const profile = req.profile!;

  const [payment] = await db
    .select()
    .from(subscriptionPaymentsTable)
    .where(eq(subscriptionPaymentsTable.id, id))
    .limit(1);

  if (!payment) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  await db.update(subscriptionPaymentsTable).set({
    status: "rejected",
    reviewedBy: profile.id,
    reviewedAt: new Date(),
  }).where(eq(subscriptionPaymentsTable.id, id));

  res.json({ message: "Payment rejected" });
});

// Super admin: freeze a school
router.post("/schools/:id/freeze", requireSuperAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const [school] = await db.update(schoolsTable).set({ status: "frozen" }).where(eq(schoolsTable.id, id)).returning();
  if (!school) {
    res.status(404).json({ error: "School not found" });
    return;
  }
  res.json({ message: "School account frozen", status: "frozen" });
});

// Super admin: unfreeze a school
router.post("/schools/:id/unfreeze", requireSuperAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const [school] = await db.update(schoolsTable).set({ status: "active" }).where(eq(schoolsTable.id, id)).returning();
  if (!school) {
    res.status(404).json({ error: "School not found" });
    return;
  }
  res.json({ message: "School account activated", status: "active" });
});

// Super admin: update monthly fee for a school
router.patch("/schools/:id/monthly-fee", requireSuperAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const parsed = z.object({ monthlyFee: z.number().min(0) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid fee amount" });
    return;
  }
  const [school] = await db.update(schoolsTable)
    .set({ monthlyFee: parsed.data.monthlyFee.toString() })
    .where(eq(schoolsTable.id, id))
    .returning();
  if (!school) {
    res.status(404).json({ error: "School not found" });
    return;
  }
  res.json({ monthlyFee: parseFloat(school.monthlyFee) });
});

export default router;
