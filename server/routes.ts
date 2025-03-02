import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertPatientSchema, insertDonationSchema } from "@shared/schema";
import Razorpay from "razorpay";
import { severityScorer } from "./services/severity-scorer";

const razorpayKeyId = process.env.RAZORPAY_KEY_ID || "rzp_test_default";
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "test_secret";

const razorpay = new Razorpay({
  key_id: razorpayKeyId,
  key_secret: razorpayKeySecret,
});

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Expose Razorpay key to frontend
  app.get("/api/razorpay-key", (_req, res) => {
    res.json({ key: razorpayKeyId });
  });

  // Get all patients sorted by severity
  app.get("/api/patients", async (_req, res) => {
    try {
      const patients = await storage.getPatients();
      res.json(JSON.parse(JSON.stringify(patients)));
    } catch (error) {
      console.error('Error fetching patients:', error);
      res.status(500).json({ message: "Failed to fetch patients" });
    }
  });

  // Get single patient by ID
  app.get("/api/patients/:id", async (req, res) => {
    try {
      const patient = await storage.getPatient(parseInt(req.params.id));
      if (!patient) return res.status(404).send("Patient not found");
      res.json(JSON.parse(JSON.stringify(patient)));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch patient" });
    }
  });

  // Get patient by user ID
  app.get("/api/patients/user/:userId", async (req, res) => {
    try {
      const patient = await storage.getPatientByUserId(parseInt(req.params.userId));
      if (!patient) return res.status(404).send("Patient not found");
      res.json(JSON.parse(JSON.stringify(patient)));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch patient" });
    }
  });

  // Update patient hospital account
  app.post("/api/patients/wallets", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.user?.isPatient) return res.status(403).send("Only patients can update account details");

    try {
      const patient = await storage.getPatient(req.user.id);
      if (!patient) return res.status(404).send("Patient profile not found");

      await storage.updatePatientWallets(req.user.id, {
        hospitalWallet: req.body.hospitalWallet,
      });

      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ message: "Failed to update wallet" });
    }
  });

  // Create patient profile (authenticated)
  app.post("/api/patients", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.user?.isPatient) return res.status(403).send("Only patients can create profiles");

    try {
      const result = insertPatientSchema.safeParse(req.body);
      if (!result.success) {
        console.error('Validation error:', result.error);
        return res.status(400).json({ message: "Invalid form data", errors: result.error.errors });
      }

      // Calculate severity score and required days with all medical information
      const { score, requiredDays } = await severityScorer.calculateSeverityScore(
        result.data.condition,
        result.data.description,
        result.data.doctorsNote,
        result.data.age,
        result.data.symptoms,
        result.data.diagnosis,
        result.data.treatmentPlan,
        result.data.medicalHistory
      );

      // Create patient profile in database
      const patient = await storage.createPatient(req.user.id, {
        ...result.data,
        severityScore: score,
        requiredDays,
      });

      // Return the created patient data
      res.status(201).json(JSON.parse(JSON.stringify(patient)));
    } catch (error) {
      console.error('Error creating patient profile:', error);
      res.status(500).json({ message: "Failed to create patient profile" });
    }
  });

  // Create Razorpay order
  app.post("/api/donations/:patientId/order", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const result = insertDonationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Invalid donation amount",
          errors: result.error.errors
        });
      }

      const patient = await storage.getPatient(parseInt(req.params.patientId));
      if (!patient) return res.status(404).send("Patient not found");

      // Verify amount is valid
      if (result.data.amount <= 0) {
        return res.status(400).json({ message: "Invalid donation amount" });
      }

      const options = {
        amount: Math.round(result.data.amount * 100), // Convert to paise
        currency: "INR",
        receipt: `rcpt_${Date.now()}`,
        notes: {
          patientId: req.params.patientId,
          donorId: req.user.id.toString(),
        },
      };

      try {
        const order = await razorpay.orders.create(options);
        res.json(order);
      } catch (razorpayError) {
        console.error("Razorpay order creation failed:", razorpayError);
        res.status(500).json({ message: "Failed to create payment order" });
      }
    } catch (error) {
      console.error("Order creation failed:", error);
      res.status(500).json({ message: "Failed to create payment order" });
    }
  });

  // Verify and complete payment
  app.post("/api/donations/:patientId/verify", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        amount,
      } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ message: "Missing payment details" });
      }

      // Verify Razorpay signature
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "test_secret")
        .update(body.toString())
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ message: "Invalid payment signature" });
      }

      const result = insertDonationSchema.safeParse({ amount });
      if (!result.success) {
        return res.status(400).json({
          message: "Invalid donation amount",
          errors: result.error.errors
        });
      }

      const patientId = parseInt(req.params.patientId);
      const patient = await storage.getPatient(patientId);
      if (!patient) return res.status(404).send("Patient not found");

      // Create donation record and update amount in database
      const donation = await storage.createDonation(
        req.user.id,
        patientId,
        result.data
      );

      // Update patient's raised amount in database
      await storage.updatePatientAmount(patientId, result.data.amount);

      res.status(201).json(JSON.parse(JSON.stringify(donation)));
    } catch (error) {
      console.error('Payment verification failed:', error);
      res.status(500).json({ message: "Failed to verify payment" });
    }
  });

  // Get authenticated user's donations
  app.get("/api/donations", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const donations = await storage.getDonationsByDonor(req.user.id);
      res.json(JSON.parse(JSON.stringify(donations)));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch donations" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}