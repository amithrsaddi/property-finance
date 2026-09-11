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

function loopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}

function privateLanHost(hostname: string): boolean {
  return /^(10|127)\.\d+\.\d+\.\d+$/.test(hostname) || /^192\.168\.\d+\.\d+$/.test(hostname) || /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname);
}

function sameDevOrigin(left: string, right: string): boolean {
  try {
    const a = new URL(left);
    const b = new URL(right);
    if (a.protocol !== b.protocol || a.port !== b.port) {
      return false;
    }
    if (a.hostname === b.hostname) {
      return true;
    }
    return loopbackHost(a.hostname) && loopbackHost(b.hostname);
  } catch {
    return false;
  }
}

function corsOrigin(): CorsOptions["origin"] {
  const allowed = (process.env.WEBCLIENT_ORIGIN || "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    const request = origin.replace(/\/$/, "");
    if (!allowed.length || allowed.some((item) => sameDevOrigin(item, request))) {
      callback(null, true);
      return;
    }
    try {
      const host = new URL(request).hostname;
      if (loopbackHost(host) || privateLanHost(host)) {
        callback(null, true);
        return;
      }
    } catch {
      /* fall through */
    }
    callback(null, false);
  };
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
  app.use(
    cors({
      origin: corsOrigin(),
      exposedHeaders: ["Content-Disposition"]
    })
  );
  app.use(parseServerlessBody);
  app.use(express.json({ limit: "32mb" }));

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
