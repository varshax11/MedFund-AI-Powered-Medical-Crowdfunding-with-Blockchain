import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db, pool } from "./db";
import { mlSeverityModel } from "./services/ml-severity-model";
import { trainModel } from "./services/train-severity-model";
import * as path from "path";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
  });

  next();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  setTimeout(() => process.exit(1), 1000);
});

(async () => {
  try {
    // Test database connection
    log('Testing database connection...');
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    log('Database connection successful');

    // Initialize ML model
    log('Initializing ML severity model...');
    const modelInitialized = await mlSeverityModel.initialize();
    if (!modelInitialized) {
      log('Training ML model with dataset...');
      const datasetPath = path.join(__dirname, '../attached_assets/patient_severity_dataset.csv');
      const trained = await trainModel(datasetPath);
      if (trained) {
        log('ML model training completed successfully');
      } else {
        log('Warning: ML model training failed, using fallback scoring');
      }
    }

    const server = await registerRoutes(app);

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    // Setup development server with Vite
    if (process.env.NODE_ENV !== "production") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Explicitly use port 5000 for Replit's development environment
    const port = 5000;
    server.listen(port, "0.0.0.0", () => {
      log(`Server started successfully on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();