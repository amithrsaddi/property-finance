import { Router } from "express";
import { requireAuth } from "../auth.js";
import { loadDashboardOverview } from "../services/dashboard.js";
import type { AuthedRequest } from "../types.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const overview = await loadDashboardOverview(req.user!.id, req.query.year, req.query.scope);
  return res.json(overview);
});

export default router;
