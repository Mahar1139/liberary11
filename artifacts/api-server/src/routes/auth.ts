import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, profilesTable, schoolsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth, requireSuperAdmin, JWT_SECRET, type AuthRequest } from "../middlewares/requireAuth";
import { z } from "zod";

const router = Router();

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const CreateUserBody = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["super_admin", "librarian_head"]),
  fullName: z.string().min(1),
  phone: z.string().default(""),
  schoolId: z.string().optional(),
});

const SetupBody = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
  phone: z.string().default(""),
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email, password } = parsed.data;
  const profiles = await db.select().from(profilesTable).where(eq(profilesTable.email, email.toLowerCase())).limit(1);
  if (profiles.length === 0) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const profile = profiles[0];
  const valid = await bcrypt.compare(password, profile.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const token = jwt.sign({ userId: profile.id }, JWT_SECRET, { expiresIn: "7d" });
  res.cookie("token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
  res.json({
    id: profile.id,
    email: profile.email,
    role: profile.role,
    fullName: profile.fullName,
    phone: profile.phone,
    schoolId: profile.schoolId ?? null,
  });
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie("token", { path: "/", sameSite: "none", secure: true });
  res.json({ message: "Logged out" });
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  const profile = req.profile!;
  res.json({
    id: profile.id,
    email: profile.email,
    role: profile.role,
    fullName: profile.fullName,
    phone: profile.phone,
    schoolId: profile.schoolId ?? null,
  });
});

router.post("/auth/setup", async (req, res) => {
  const [{ total }] = await db.select({ total: count() }).from(profilesTable);
  if (total > 0) {
    res.status(409).json({ error: "System already set up. Use admin panel to create users." });
    return;
  }
  const parsed = SetupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email, password, fullName, phone } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  const [profile] = await db.insert(profilesTable).values({
    email: email.toLowerCase(),
    passwordHash,
    role: "super_admin",
    fullName,
    phone: phone || "",
  }).returning();
  const token = jwt.sign({ userId: profile.id }, JWT_SECRET, { expiresIn: "7d" });
  res.cookie("token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
  res.status(201).json({
    id: profile.id,
    email: profile.email,
    role: profile.role,
    fullName: profile.fullName,
    phone: profile.phone,
    schoolId: null,
  });
});

router.post("/auth/users", requireSuperAdmin, async (req: AuthRequest, res) => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email, password, role, fullName, phone, schoolId } = parsed.data;
  const existing = await db.select().from(profilesTable).where(eq(profilesTable.email, email.toLowerCase())).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "User with this email already exists" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [profile] = await db.insert(profilesTable).values({
    email: email.toLowerCase(),
    passwordHash,
    role,
    fullName,
    phone: phone || "",
    schoolId: schoolId || null,
  }).returning();
  res.status(201).json({
    id: profile.id,
    email: profile.email,
    role: profile.role,
    fullName: profile.fullName,
    phone: profile.phone,
    schoolId: profile.schoolId ?? null,
  });
});

router.put("/auth/users/:id/password", requireSuperAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const parsed = z.object({ password: z.string().min(6) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const [profile] = await db.update(profilesTable).set({ passwordHash }).where(eq(profilesTable.id, id)).returning();
  if (!profile) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ message: "Password updated" });
});

export default router;
