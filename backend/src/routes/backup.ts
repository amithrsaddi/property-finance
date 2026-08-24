import { Router } from "express";
import { requireAuth, toPublicUser } from "../auth.js";
import { exportUserBackup, parseBackupPayload, restoreUserBackup } from "../backup.js";
import { User } from "../models.js";
import type { AuthedRequest } from "../types.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const backup = await exportUserBackup(req.user!.id);
  const day = backup.exportedAt.slice(0, 10);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="property-finance-backup-${day}.json"`);
  res.setHeader("Cache-Control", "private, no-store");
  return res.send(JSON.stringify(backup, null, 2));
});

router.post("/restore", async (req: AuthedRequest, res) => {
  let payload;
  try {
    payload = parseBackupPayload(req.body);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }

  const counts = await restoreUserBackup(req.user!.id, payload);
  const user = await User.findById(req.user!.id).lean();
  return res.json({
    user: user ? toPublicUser(user) : req.user,
    counts,
    message: "Backup restored."
  });
});

export default router;
