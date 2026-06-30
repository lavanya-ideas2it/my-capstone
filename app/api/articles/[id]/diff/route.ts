import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { handleRoute, json } from "@/lib/http";
import { diffRevisions } from "@/lib/revisions";
import { diffQuery, parseQuery } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/articles/:id/diff?from=&to= — VIEWER+. Computed on read (AC9.1).
export async function GET(req: NextRequest, ctx: Ctx) {
  return handleRoute(async () => {
    await requireRole(req, Role.VIEWER);
    const { id } = await ctx.params;
    const { from, to } = parseQuery(diffQuery, req.nextUrl.searchParams);
    const result = await diffRevisions(id, from, to);
    return json(result);
  });
}
