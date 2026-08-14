import express from "express";
import cors, { type CorsOptions } from "cors";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import propertyRoutes from "./routes/properties.js";
import rentRoutes from "./routes/rent.js";
import mortgageRoutes from "./routes/mortgages.js";
import expenseRoutes from "./routes/expenses.js";
import dashboardRoutes from "./routes/dashboard.js";
import reportRoutes from "./routes/reports.js";

function corsOrigin(): CorsOptions["origin"] {
  const raw = process.env.WEBCLIENT_ORIGIN;
  if (!raw) {
    return true;
  }
  const origins = raw.split(",").map((value) => value.trim()).filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
}

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(
    cors({
      origin: corsOrigin()
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
  app.use("/dashboard", dashboardRoutes);
  app.use("/reports", reportRoutes);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ message: err.message || "Unexpected server error." });
  });

  return app;
}
