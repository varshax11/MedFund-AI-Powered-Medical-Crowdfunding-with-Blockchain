import { pgTable, text, serial, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isPatient: boolean("is_patient").notNull().default(false),
  name: text("name").notNull(),
  email: text("email").notNull(),
});

export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  condition: text("condition").notNull(),
  description: text("description").notNull(),
  fundingGoal: real("funding_goal").notNull(), // In Rupees
  amountRaised: real("amount_raised").notNull().default(0), // In Rupees
  severityScore: integer("severity_score").notNull(),
  requiredDays: integer("required_days").notNull(),
  hospitalWallet: text("hospital_wallet"), // Will store bank account/UPI details
  doctorsNote: text("doctors_note").notNull(),
  age: integer("age").notNull(),
  symptoms: text("symptoms").notNull(),
  diagnosis: text("diagnosis").notNull(),
  treatmentPlan: text("treatment_plan").notNull(),
  medicalHistory: text("medical_history"),
});

export const donations = pgTable("donations", {
  id: serial("id").primaryKey(),
  donorId: integer("donor_id").notNull(),
  patientId: integer("patient_id").notNull(),
  amount: real("amount").notNull(), // In Rupees
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Create schemas for form validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  isPatient: true,
  name: true,
  email: true,
});

export const insertPatientSchema = createInsertSchema(patients)
  .omit({
    id: true,
    userId: true,
    amountRaised: true,
    severityScore: true,
    requiredDays: true,
  })
  .extend({
    condition: z.string().min(3, "Medical condition must be at least 3 characters"),
    description: z.string().min(20, "Description must be at least 20 characters"),
    fundingGoal: z.number().min(1000, "Minimum funding goal is ₹1,000"),
    hospitalWallet: z.string().min(5, "Please enter a valid bank account or UPI ID"),
    doctorsNote: z.string().min(10, "Doctor's note is required"),
    age: z.number().min(0, "Age must be valid"),
    symptoms: z.string().min(5, "Please list the main symptoms"),
    diagnosis: z.string().min(5, "Please provide the diagnosis"),
    treatmentPlan: z.string().min(10, "Treatment plan is required"),
    medicalHistory: z.string().optional(),
  });

export const insertDonationSchema = createInsertSchema(donations).pick({
  amount: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type InsertDonation = z.infer<typeof insertDonationSchema>;

export type User = typeof users.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type Donation = typeof donations.$inferSelect;