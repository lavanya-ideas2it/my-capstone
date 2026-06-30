import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { handleRoute, json } from "@/lib/http";
import { searchArticles } from "@/lib/search";
import { parseQuery, searchQuery } from "@/lib/validation";

// GET /api/search?q=&page=&limit= — VIEWER+. Postgres FTS, ranked + highlighted
// (SPEC US-11 / §2.1). The query string is bound, never interpolated (§4).
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireRole(req, Role.VIEWER);
    const { q, page, limit } = parseQuery(searchQuery, req.nextUrl.searchParams);
    const { items, total } = await searchArticles(q, page, limit);
    return json({ items, total, page });
  });
}
