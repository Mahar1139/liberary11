import { Router } from "express";
import { db, profilesTable, schoolsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireSuperAdmin, type AuthRequest } from "../middlewares/requireAuth";
import { UpdateProfileBody } from "@workspace/api-zod";

const router = Router();

router.get("/profiles/me", requireAuth, async (req: AuthRequest, res) => {
  const profile = req.profile;
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json({
    id: profile.id,
    email: profile.email,
    role: profile.role,
    schoolId: profile.schoolId ?? null,
    fullName: profile.fullName,
    phone: profile.phone,
  });
});

router.get("/profiles", requireSuperAdmin, async (_req, res) => {
  const profiles = await db
    .select({
      id: profilesTable.id,
      email: profilesTable.email,
      role: profilesTable.role,
      schoolId: profilesTable.schoolId,
      schoolName: schoolsTable.name,
      fullName: profilesTable.fullName,
      phone: profilesTable.phone,
    })
    .from(profilesTable)
    .leftJoin(schoolsTable, eq(profilesTable.schoolId, schoolsTable.id));

  res.json(profiles.map(p => ({
    ...p,
    schoolName: p.schoolName ?? null,
    schoolId: p.schoolId ?? null,
  })));
});

router.put("/profiles/:id", requireSuperAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [profile] = await db.update(profilesTable)
    .set(parsed.data)
    .where(eq(profilesTable.id, id))
    .returning();
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json({
    id: profile.id,
    email: profile.email,
    role: profile.role,
    schoolId: profile.schoolId ?? null,
    fullName: profile.fullName,
    phone: profile.phone,
  });
});

router.delete("/profiles/:id", requireSuperAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  await db.delete(profilesTable).where(eq(profilesTable.id, id));
  res.json({ message: "Profile deleted" });
});

export default router;
