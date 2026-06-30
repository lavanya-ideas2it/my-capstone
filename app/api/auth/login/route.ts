import type { NextRequest } from "next/server";
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiry,
  setRefreshCookie,
  signAccessToken,
  toPublicUser,
  verifyPassword,
} from "@/lib/auth";
import { handleRoute, json, readJson, tooManyRequests, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientIp } from "@/lib/ratelimit";
import { loginSchema } from "@/lib/validation";

// POST /api/auth/login — public. Returns an access token + sets a refresh cookie.
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    // Rate-limit to 20 attempts per IP per 15 minutes (brute-force protection).
    if (!checkRateLimit(`login:${clientIp(req)}`, 20, 15 * 60_000)) {
      throw tooManyRequests("Too many login attempts. Please try again later.");
    }

    const { email, password } = loginSchema.parse(await readJson(req));

    const user = await prisma.user.findUnique({ where: { email } });
    const passwordOk = user
      ? await verifyPassword(user.passwordHash, password)
      : false;
    // Generic message either way — never reveal whether the email exists (AC1.2).
    if (!user || !passwordOk) throw unauthorized("Invalid credentials");

    const refreshToken = generateRefreshToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt: refreshExpiry(),
        userAgent: req.headers.get("user-agent"),
        ip: req.headers.get("x-forwarded-for"),
      },
    });

    const accessToken = await signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const res = json({ user: toPublicUser(user), accessToken }, 200);
    setRefreshCookie(res, refreshToken);
    return res;
  });
}
