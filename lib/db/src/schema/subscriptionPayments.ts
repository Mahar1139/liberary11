import { decimal, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { schoolsTable } from "./schools";
import { profilesTable } from "./profiles";

export const subscriptionPaymentsTable = pgTable("subscription_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schoolsTable.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentReference: text("payment_reference").notNull(),
  notes: text("notes"),
  month: text("month").notNull(),
  year: text("year").notNull(),
  status: text("status").notNull().default("pending"),
  submittedBy: uuid("submitted_by").notNull().references(() => profilesTable.id, { onDelete: "restrict" }),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  reviewedBy: uuid("reviewed_by").references(() => profilesTable.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
});

export const insertSubscriptionPaymentSchema = createInsertSchema(subscriptionPaymentsTable).omit({ id: true, submittedAt: true });
export type InsertSubscriptionPayment = z.infer<typeof insertSubscriptionPaymentSchema>;
export type SubscriptionPayment = typeof subscriptionPaymentsTable.$inferSelect;
