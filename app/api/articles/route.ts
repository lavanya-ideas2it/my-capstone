import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createArticle, listArticles } from "@/lib/articles";
import { handleRoute, json, readJson } from "@/lib/http";
import { createArticleSchema, paginationQuery, parseQuery } from "@/lib/validation";

// GET /api/articles — VIEWER+. Paginated list, optional ?tag= filter.
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireRole(req, Role.VIEWER);
    const { tag, page, limit } = parseQuery(
      paginationQuery,
      req.nextUrl.searchParams
    );
    const { items, total } = await listArticles({ tag, page, limit });
    return json({ items, total, page });
  });
}

// POST /api/articles — EDITOR+. Creates an article + its v1 revision (AC4.1).
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const user = await requireRole(req, Role.EDITOR);
    const input = createArticleSchema.parse(await readJson(req));
    const article = await createArticle(user.id, input);
    return json({ article }, 201);
  });
}
