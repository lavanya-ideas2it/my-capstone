import type { NextRequest } from "next/server";
import {
  REFRESH_COOKIE,
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiry,
  setRefreshCookie,
  signAccessToken,
} from "@/lib/auth";
import { handleRoute, json, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// POST /api/auth/refresh — exchanges a valid refresh cookie for a new access
// token and rotates the refresh token (SPEC §4).
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const token = req.cookies.get(REFRESH_COOKIE)?.value;
    if (!token) throw unauthorized();

    const session = await prisma.session.findUnique({
      where: { refreshTokenHash: hashRefreshToken(token) },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw unauthorized("Invalid session");
    }

    // Rotate the refresh token on every use.
    const nextToken = generateRefreshToken();
    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: hashRefreshToken(nextToken),
        expiresAt: refreshExpiry(),
      },
    });

    const accessToken = await signAccessToken({
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
    });

    const res = json({ accessToken });
    setRefreshCookie(res, nextToken);
    return res;
  });
}
