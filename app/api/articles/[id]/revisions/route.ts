import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { handleRoute, json } from "@/lib/http";
import { listRevisions } from "@/lib/revisions";
import { parseQuery, revisionsQuery } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/articles/:id/revisions — VIEWER+. Newest-first history (AC8.1).
export async function GET(req: NextRequest, ctx: Ctx) {
  return handleRoute(async () => {
    await requireRole(req, Role.VIEWER);
    const { id } = await ctx.params;
    const { page, limit } = parseQuery(revisionsQuery, req.nextUrl.searchParams);
    const revisions = await listRevisions(id, page, limit);
    return json({ revisions });
  });
}
