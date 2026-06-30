import { Role } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { conflict, handleRoute, json, notFound, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { updateTagSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// PUT /api/tags/:id — EDITOR+. Renames a tag (AC10.2).
export async function PUT(req: NextRequest, ctx: Ctx) {
  return handleRoute(async () => {
    await requireRole(req, Role.EDITOR);
    const { id } = await ctx.params;
    const { name } = updateTagSchema.parse(await readJson(req));

    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag) throw notFound("Tag not found");

    const slug = slugify(name);
    const clash = await prisma.tag.findFirst({
      where: { OR: [{ name }, { slug }], NOT: { id } },
    });
    if (clash) throw conflict("Another tag already uses that name");

    const updated = await prisma.tag.update({
      where: { id },
      data: { name, slug },
    });
    return json({ tag: updated });
  });
}

// DELETE /api/tags/:id — ADMIN only (AC10.2).
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return handleRoute(async () => {
    await requireRole(req, Role.ADMIN);
    const { id } = await ctx.params;

    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag) throw notFound("Tag not found");

    await prisma.tag.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  });
}
