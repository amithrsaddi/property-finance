import express from "express";
import cors, { type CorsOptions } from "cors";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import propertyRoutes from "./routes/properties.js";
import rentRoutes from "./routes/rent.js";
import mortgageRoutes from "./routes/mortgages.js";
import expenseRoutes from "./routes/expenses.js";
import documentRoutes from "./routes/documents.js";
import folderRoutes from "./routes/folders.js";
import dashboardRoutes from "./routes/dashboard.js";
import reportRoutes from "./routes/reports.js";
import backupRoutes from "./routes/backup.js";

function corsOrigin(): CorsOptions["origin"] {
  const raw = process.env.WEBCLIENT_ORIGIN;
  if (!raw) {
    return true;
  }
  const origins = raw.split(",").map((value) => value.trim()).filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
}

function parseServerlessBody(req: express.Request, _res: express.Response, next: express.NextFunction): void {
  const existing = req.body as unknown;
  if (!Buffer.isBuffer(existing) && typeof existing !== "string") {
    next();
    return;
  }

  const raw = (Buffer.isBuffer(existing) ? existing.toString("utf8") : existing).trim();
  if (!raw) {
    req.body = {};
    next();
    return;
  }

  try {
    req.body = JSON.parse(raw);
    (req as express.Request & { _body?: boolean })._body = true;
  } catch {
    // Leave the raw body for express.json() to reject with its usual error.
  }
  next();
}

export function createApp(): express.Express {
  const app = express();
  app.use(parseServerlessBody);
  app.use(express.json({ limit: "32mb" }));
  app.use(
    cors({
      origin: corsOrigin(),
      exposedHeaders: ["Content-Disposition"]
    })
  );

  app.get("/health", (_req, res) => {
    return res.json({ status: "ok" });
  });

  app.use("/auth", authRoutes);
  app.use("/profile", profileRoutes);
  app.use("/properties", propertyRoutes);
  app.use("/rent", rentRoutes);
  app.use("/mortgages", mortgageRoutes);
  app.use("/expenses", expenseRoutes);
  app.use("/folders", folderRoutes);
  app.use("/documents", documentRoutes);
  app.use("/dashboard", dashboardRoutes);
  app.use("/reports", reportRoutes);
  app.use("/backup", backupRoutes);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ message: err.message || "Unexpected server error." });
  });

  return app;
}
