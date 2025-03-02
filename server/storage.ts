import { InsertUser, User, InsertPatient, Patient, InsertDonation, Donation } from "@shared/schema";
import { users, patients, donations } from "@shared/schema";
import { db, eq, desc, asc } from "./db";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Patient operations
  getPatient(id: number): Promise<Patient | undefined>;
  getPatientByUserId(userId: number): Promise<Patient | undefined>;
  getPatients(): Promise<Patient[]>;
  createPatient(userId: number, patient: InsertPatient): Promise<Patient>;
  updatePatientAmount(id: number, amount: number): Promise<Patient>;
  updatePatientWallets(userId: number, wallets: { hospitalWallet: string }): Promise<void>;

  // Donation operations
  createDonation(donorId: number, patientId: number, donation: InsertDonation): Promise<Donation>;
  getDonationsByDonor(donorId: number): Promise<Donation[]>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      isPatient: insertUser.isPatient ?? false,
    }).returning();
    return user;
  }

  async getPatient(id: number): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.id, id));
    return patient;
  }

  async getPatientByUserId(userId: number): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.userId, userId));
    return patient;
  }

  async getPatients(): Promise<Patient[]> {
    const patientList = await db
      .select()
      .from(patients) 
      .orderBy(desc(patients.severityScore))
      .orderBy(asc(patients.requiredDays));

    return patientList;
  }

  async createPatient(userId: number, insertPatient: InsertPatient): Promise<Patient> {
    const [patient] = await db.insert(patients).values({
      ...insertPatient,
      userId,
      amountRaised: 0,
    }).returning();
    return patient;
  }

  async updatePatientAmount(id: number, amount: number): Promise<Patient> {
    const patient = await this.getPatient(id);
    if (!patient) throw new Error("Patient not found");

    const [updatedPatient] = await db
      .update(patients)
      .set({ amountRaised: patient.amountRaised + amount })
      .where(eq(patients.id, id))
      .returning();

    return updatedPatient;
  }

  async createDonation(donorId: number, patientId: number, insertDonation: InsertDonation): Promise<Donation> {
    const [donation] = await db.insert(donations).values({
      ...insertDonation,
      donorId,
      patientId,
    }).returning();
    return donation;
  }

  async getDonationsByDonor(donorId: number): Promise<Donation[]> {
    return await db
      .select()
      .from(donations)
      .where(eq(donations.donorId, donorId))
      .orderBy(desc(donations.createdAt));
  }

  async updatePatientWallets(userId: number, wallets: { hospitalWallet: string }): Promise<void> {
    await db
      .update(patients)
      .set(wallets)
      .where(eq(patients.userId, userId));
  }
}

export const storage = new DatabaseStorage();