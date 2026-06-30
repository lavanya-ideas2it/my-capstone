// Authentication & authorization helpers (SPEC §4).
//
//  - Passwords: argon2id.
//  - Access token: short-lived HS256 JWT (claims: sub=userId, role, email).
//  - Refresh token: high-entropy random string, SHA-256-hashed in `Session`,
//    delivered in an httpOnly/SameSite=Strict cookie, rotated on each refresh.
//  - requireUser / requireRole gate every protected handler (401 then 403); the
//    role is read from the verified token, never trusted from the client.
import { createHash, randomBytes } from "node:crypto";
import { Role, type User } from "@prisma/client";
import argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import type { NextResponse } from "next/server";
import { forbidden, unauthorized } from "./http";

export type AuthUser = { id: string; email: string; role: Role };
export type PublicUser = Pick<
  User,
  "id" | "email" | "name" | "role" | "createdAt" | "updatedAt"
>;

const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL ?? "15m";
const REFRESH_TTL_DAYS = 30;
export const REFRESH_COOKIE = "refreshToken";

const ROLE_RANK: Record<Role, number> = {
  [Role.VIEWER]: 1,
  [Role.EDITOR]: 2,
  [Role.ADMIN]: 3,
};

function secretKey(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  // HS256 requires ≥256 bits of key material; enforce a 32-character minimum.
  if (s.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
  return new TextEncoder().encode(s);
}

// ---------- Passwords ----------
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain).catch(() => false);
}

// ---------- Access tokens ----------
export async function signAccessToken(user: AuthUser): Promise<string> {
  return new SignJWT({ role: user.role, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secretKey());
}

export async function verifyAccessToken(token: string): Promise<AuthUser> {
  const { payload } = await jwtVerify(token, secretKey());
  return {
    id: String(payload.sub),
    email: String(payload.email),
    role: payload.role as Role,
  };
}

// ---------- Refresh tokens / sessions ----------
export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshExpiry(now = new Date()): Date {
  return new Date(now.getTime() + REFRESH_TTL_DAYS * 86_400_000);
}

// ---------- Cookie helpers ----------
export function setRefreshCookie(res: NextResponse, token: string): void {
  res.cookies.set({
    name: REFRESH_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: REFRESH_TTL_DAYS * 86_400,
  });
}

export function clearRefreshCookie(res: NextResponse): void {
  res.cookies.set({
    name: REFRESH_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

// ---------- Gates ----------
function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

/** Resolve the authenticated user from the access token, or throw 401. */
export async function requireUser(req: Request): Promise<AuthUser> {
  const token = getBearerToken(req);
  if (!token) throw unauthorized();
  try {
    return await verifyAccessToken(token);
  } catch {
    throw unauthorized("Invalid or expired token");
  }
}

/** Require at least `min` role (VIEWER < EDITOR < ADMIN), else 401/403. */
export async function requireRole(
  req: Request,
  min: Role
): Promise<AuthUser> {
  const user = await requireUser(req);
  if (ROLE_RANK[user.role] < ROLE_RANK[min]) throw forbidden();
  return user;
}

// ---------- Serialization ----------
export function toPublicUser(user: PublicUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
