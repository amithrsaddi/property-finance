import { Router } from "express";
import crypto from "node:crypto";
import {
  createAccessToken,
  hashPassword,
  hashToken,
  requireAuth,
  toPublicUser,
  verifyPassword
} from "../auth.js";
import { PasswordResetToken, User } from "../models.js";
import type { AuthedRequest } from "../types.js";

const router = Router();

router.post("/register", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").toLowerCase().trim();
  const password = String(req.body?.password || "");

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required." });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters." });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }

  const created = await User.create({
    name,
    email,
    passwordHash: hashPassword(password),
    preferredCurrency: "GBP",
    decimalPrecision: 2
  });

  const user = toPublicUser(created);

  return res.status(201).json({
    message: "Registration successful.",
    token: createAccessToken(user),
    user
  });
});

router.post("/login", async (req, res) => {
  const email = String(req.body?.email || "").toLowerCase().trim();
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const row = await User.findOne({ email });
  if (!row || !verifyPassword(password, row.passwordHash)) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const user = toPublicUser(row);

  return res.json({
    message: `Welcome back, ${user.name}.`,
    token: createAccessToken(user),
    user
  });
});

router.post("/logout", requireAuth, (_req, res) => {
  return res.json({ message: "Logged out." });
});

router.get("/me", requireAuth, (req: AuthedRequest, res) => {
  return res.json({ user: req.user });
});

router.post("/forgot-password", async (req, res) => {
  const email = String(req.body?.email || "").toLowerCase().trim();
  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  const generic = {
    message: "If an account exists for that email, a reset link has been generated."
  };

  const user = await User.findOne({ email });
  if (!user) {
    return res.json(generic);
  }

  const token = crypto.randomBytes(32).toString("hex");
  await PasswordResetToken.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000)
  });

  const origin = process.env.WEBCLIENT_ORIGIN || process.env.URL || "http://localhost:5173";
  const resetUrl = `${origin}/reset-password.html?token=${token}`;
  console.log(`[password-reset] ${user.email}: ${resetUrl}`);

  return res.json({
    ...generic,
    ...(process.env.NODE_ENV !== "production" ? { resetUrl, token } : {})
  });
});

router.post("/reset-password", async (req, res) => {
  const token = String(req.body?.token || "");
  const password = String(req.body?.password || "");

  if (!token || !password) {
    return res.status(400).json({ message: "Token and new password are required." });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters." });
  }

  const row = await PasswordResetToken.findOne({ tokenHash: hashToken(token) });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    return res.status(400).json({ message: "Invalid or expired reset token." });
  }

  await User.findByIdAndUpdate(row.userId, { passwordHash: hashPassword(password) });
  row.usedAt = new Date();
  await row.save();

  return res.json({ message: "Password updated. You can sign in now." });
});

export default router;
