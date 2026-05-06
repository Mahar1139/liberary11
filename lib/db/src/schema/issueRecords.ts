import { boolean, decimal, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { schoolsTable } from "./schools";
import { booksTable } from "./books";
import { studentsTable } from "./students";
import { profilesTable } from "./profiles";

export const issueStatusEnum = pgEnum("issue_status", ["issued", "returned", "overdue"]);

export const issueRecordsTable = pgTable("issue_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schoolsTable.id, { onDelete: "cascade" }),
  bookId: uuid("book_id").notNull().references(() => booksTable.id, { onDelete: "restrict" }),
  studentId: uuid("student_id").notNull().references(() => studentsTable.id, { onDelete: "restrict" }),
  issuedBy: uuid("issued_by").notNull().references(() => profilesTable.id, { onDelete: "restrict" }),
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date").notNull(),
  returnDate: text("return_date"),
  fineAmount: decimal("fine_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  finePaid: boolean("fine_paid").notNull().default(false),
  status: issueStatusEnum("status").notNull().default("issued"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIssueRecordSchema = createInsertSchema(issueRecordsTable).omit({ id: true, createdAt: true });
export type InsertIssueRecord = z.infer<typeof insertIssueRecordSchema>;
export type IssueRecord = typeof issueRecordsTable.$inferSelect;
