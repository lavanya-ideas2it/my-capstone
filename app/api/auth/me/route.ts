import type { NextRequest } from "next/server";
import { requireUser, toPublicUser } from "@/lib/auth";
import { handleRoute, json, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// GET /api/auth/me — the authenticated user (fresh from the DB).
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireUser(req);
    const user = await prisma.user.findUnique({ where: { id: auth.id } });
    if (!user) throw unauthorized();
    return json({ user: toPublicUser(user) });
  });
}
