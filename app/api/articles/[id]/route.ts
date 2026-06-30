import { Role } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  deleteArticleById,
  getArticleById,
  updateArticle,
} from "@/lib/articles";
import { handleRoute, json, readJson } from "@/lib/http";
import { updateArticleSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/articles/:id — VIEWER+. Article + tags + current revision (AC5.1).
export async function GET(req: NextRequest, ctx: Ctx) {
  return handleRoute(async () => {
    await requireRole(req, Role.VIEWER);
    const { id } = await ctx.params;
    const article = await getArticleById(id);
    return json({
      article,
      tags: article.tags,
      currentRevision: article.currentRevision,
    });
  });
}

// PUT /api/articles/:id — EDITOR+. Transactionally appends a revision (AC6.1).
export async function PUT(req: NextRequest, ctx: Ctx) {
  return handleRoute(async () => {
    const user = await requireRole(req, Role.EDITOR);
    const { id } = await ctx.params;
    const input = updateArticleSchema.parse(await readJson(req));
    const article = await updateArticle(user.id, id, input);
    return json({ article });
  });
}

// DELETE /api/articles/:id — ADMIN only. Cascades revisions (AC7.1).
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return handleRoute(async () => {
    await requireRole(req, Role.ADMIN);
    const { id } = await ctx.params;
    await deleteArticleById(id);
    return new NextResponse(null, { status: 204 });
  });
}
