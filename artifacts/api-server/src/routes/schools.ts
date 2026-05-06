import { Router } from "express";
import { db, schoolsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireSuperAdmin, type AuthRequest } from "../middlewares/requireAuth";
import { z } from "zod";

const router = Router();

const SchoolBody = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  contactEmail: z.string().email(),
  fineRatePerDay: z.coerce.number().min(0).default(2),
  monthlyFee: z.coerce.number().min(0).default(0),
});

function schoolToJson(s: typeof schoolsTable.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    address: s.address,
    contactEmail: s.contactEmail,
    fineRatePerDay: parseFloat(s.fineRatePerDay),
    monthlyFee: parseFloat(s.monthlyFee),
    status: s.status,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/schools", requireAuth, async (req, res) => {
  const schools = await db.select().from(schoolsTable).orderBy(schoolsTable.createdAt);
  res.json(schools.map(schoolToJson));
});

router.get("/schools/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const schools = await db.select().from(schoolsTable).where(eq(schoolsTable.id, id)).limit(1);
  if (schools.length === 0) {
    res.status(404).json({ error: "School not found" });
    return;
  }
  res.json(schoolToJson(schools[0]));
});

router.post("/schools", requireSuperAdmin, async (req: AuthRequest, res) => {
  const parsed = SchoolBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { name, address, contactEmail, fineRatePerDay, monthlyFee } = parsed.data;
  const [school] = await db.insert(schoolsTable).values({
    name, address, contactEmail,
    fineRatePerDay: fineRatePerDay.toString(),
    monthlyFee: monthlyFee.toString(),
    status: "active",
  }).returning();
  res.status(201).json(schoolToJson(school));
});

router.put("/schools/:id", requireSuperAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const parsed = SchoolBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { name, address, contactEmail, fineRatePerDay, monthlyFee } = parsed.data;
  const [school] = await db.update(schoolsTable).set({
    name, address, contactEmail,
    fineRatePerDay: fineRatePerDay.toString(),
    monthlyFee: monthlyFee.toString(),
  }).where(eq(schoolsTable.id, id)).returning();
  if (!school) {
    res.status(404).json({ error: "School not found" });
    return;
  }
  res.json(schoolToJson(school));
});

router.delete("/schools/:id", requireSuperAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  await db.delete(schoolsTable).where(eq(schoolsTable.id, id));
  res.json({ message: "School deleted" });
});

export default router;
