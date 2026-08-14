import { Router } from "express";
import {
  hashPassword,
  normalizeDecimalPrecision,
  requireAuth,
  toPublicUser,
  verifyPassword
} from "../auth.js";
import { Property, User } from "../models.js";
import type { AuthedRequest } from "../types.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const user = await User.findById(userId).lean();
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const properties = await Property.find({ userId }).lean();
  const active = properties.filter((p) => p.status === "active");
  const portfolioValue = active.reduce((sum, p) => {
    return sum + (Number(p.currentValue) || 0) * (Number(p.ownershipPercentage) || 0) / 100;
  }, 0);

  return res.json({
    user: toPublicUser(user),
    overview: {
      activeProperties: active.length,
      totalProperties: properties.length,
      portfolioValue
    }
  });
});

router.patch("/", async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const name = req.body?.name !== undefined ? String(req.body.name).trim() : undefined;
  const preferredCurrency =
    req.body?.preferredCurrency !== undefined
      ? String(req.body.preferredCurrency).trim().toUpperCase()
      : undefined;
  const decimalPrecision =
    req.body?.decimalPrecision !== undefined ? Number(req.body.decimalPrecision) : undefined;

  if (name !== undefined && !name) {
    return res.status(400).json({ message: "Name cannot be empty." });
  }
  if (preferredCurrency !== undefined && !/^[A-Z]{3}$/.test(preferredCurrency)) {
    return res.status(400).json({ message: "Currency must be a 3-letter code (e.g. GBP)." });
  }
  if (
    decimalPrecision !== undefined &&
    (!Number.isInteger(decimalPrecision) || decimalPrecision < 0 || decimalPrecision > 4)
  ) {
    return res.status(400).json({ message: "Decimal precision must be a whole number from 0 to 4." });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  if (name !== undefined) {
    user.name = name;
  }
  if (preferredCurrency !== undefined) {
    user.preferredCurrency = preferredCurrency;
  }
  if (decimalPrecision !== undefined) {
    user.decimalPrecision = normalizeDecimalPrecision(decimalPrecision);
  }
  await user.save();

  return res.json({
    user: toPublicUser(user),
    message: "Saved."
  });
});

router.post("/change-password", async (req: AuthedRequest, res) => {
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Current and new passwords are required." });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: "New password must be at least 6 characters." });
  }

  const user = await User.findById(req.user!.id);
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return res.status(401).json({ message: "Current password is incorrect." });
  }

  user.passwordHash = hashPassword(newPassword);
  await user.save();
  return res.json({ message: "Password changed." });
});

export default router;
