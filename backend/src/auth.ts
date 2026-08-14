import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "./models.js";
import type { AuthUser, AuthedRequest } from "./types.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_TTL = process.env.JWT_TTL || "7d";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createAccessToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      preferredCurrency: user.preferredCurrency,
      decimalPrecision: user.decimalPrecision
    },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL } as jwt.SignOptions
  );
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as jwt.JwtPayload;
    const userId = String(payload.sub || "");
    const row = await User.findById(userId).lean();

    if (!row) {
      res.status(401).json({ message: "Invalid session." });
      return;
    }

    req.user = toPublicUser(row);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired session." });
  }
}

export function normalizeDecimalPrecision(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 2;
  }
  return Math.min(4, Math.max(0, Math.round(n)));
}

export function toPublicUser(row: {
  id?: string;
  _id?: { toString(): string };
  name: string;
  email: string;
  preferredCurrency: string;
  decimalPrecision?: number | null;
}): AuthUser {
  return {
    id: row.id || String(row._id),
    name: row.name,
    email: row.email,
    preferredCurrency: row.preferredCurrency || "GBP",
    decimalPrecision: normalizeDecimalPrecision(row.decimalPrecision)
  };
}
