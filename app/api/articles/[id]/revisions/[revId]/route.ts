import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { handleRoute, json } from "@/lib/http";
import { getRevision } from "@/lib/revisions";

type Ctx = { params: Promise<{ id: string; revId: string }> };

// GET /api/articles/:id/revisions/:revId — VIEWER+. A single revision snapshot.
export async function GET(req: NextRequest, ctx: Ctx) {
  return handleRoute(async () => {
    await requireRole(req, Role.VIEWER);
    const { id, revId } = await ctx.params;
    const revision = await getRevision(id, revId);
    return json({ revision });
  });
}
