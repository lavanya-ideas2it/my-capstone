import { NextResponse, type NextRequest } from "next/server";
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  hashRefreshToken,
  requireUser,
} from "@/lib/auth";
import { handleRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// POST /api/auth/logout — revokes the current session and clears the cookie (AC2.1).
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser(req);

    const token = req.cookies.get(REFRESH_COOKIE)?.value;
    if (token) {
      await prisma.session.updateMany({
        where: {
          refreshTokenHash: hashRefreshToken(token),
          userId: user.id,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    const res = new NextResponse(null, { status: 204 });
    clearRefreshCookie(res);
    return res;
  });
}
