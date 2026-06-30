import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { conflict, handleRoute, json, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { createTagSchema } from "@/lib/validation";

// GET /api/tags — VIEWER+. Lists tags with article counts (SPEC US-10).
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireRole(req, Role.VIEWER);
    const tags = await prisma.tag.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { articles: true } } },
    });
    return json({
      tags: tags.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        articleCount: t._count.articles,
      })),
    });
  });
}

// POST /api/tags — EDITOR+. Creates a tag, deriving a unique slug from the name.
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    await requireRole(req, Role.EDITOR);
    const { name } = createTagSchema.parse(await readJson(req));
    const slug = slugify(name);

    const existing = await prisma.tag.findFirst({
      where: { OR: [{ name }, { slug }] },
    });
    if (existing) throw conflict("Tag already exists");

    const tag = await prisma.tag.create({ data: { name, slug } });
    return json({ tag }, 201);
  });
}
