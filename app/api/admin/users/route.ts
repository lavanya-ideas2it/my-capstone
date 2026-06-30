import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { handleRoute, json } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// GET /api/admin/users — ADMIN only. Lists all users (no password hashes).
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireRole(req, Role.ADMIN);
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return json({ users });
  });
}
