import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { profilesTable, schoolsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const JWT_SECRET = process.env.JWT_SECRET || "school-library-dev-secret-change-in-production";

export interface AuthRequest extends Request {
  userId?: string;
  profile?: typeof profilesTable.$inferSelect;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = payload.userId;
    const profiles = await db.select().from(profilesTable).where(eq(profilesTable.id, payload.userId)).limit(1);
    if (profiles.length > 0) {
      req.profile = profiles[0];
    }
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
};

export const requireSuperAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  await requireAuth(req, res, () => {
    if (!req.profile || req.profile.role !== "super_admin") {
      res.status(403).json({ error: "Forbidden: Super admin only" });
      return;
    }
    next();
  });
};

export const requireLibrarian = async (req: AuthRequest, res: Response, next: NextFunction) => {
  await requireAuth(req, res, async () => {
    if (!req.profile) {
      res.status(403).json({ error: "Forbidden: Profile not set up" });
      return;
    }

    // Check if school is frozen — block all librarian actions
    if (req.profile.role === "librarian_head" && req.profile.schoolId) {
      const schools = await db.select().from(schoolsTable).where(eq(schoolsTable.id, req.profile.schoolId)).limit(1);
      if (schools.length > 0 && schools[0].status === "frozen") {
        res.status(403).json({ error: "ACCOUNT_FROZEN", message: "Your school account has been frozen due to pending payment. Please contact the administrator." });
        return;
      }
    }

    next();
  });
};
