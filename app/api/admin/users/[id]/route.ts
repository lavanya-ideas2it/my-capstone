import { Prisma, Role } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { requireRole, toPublicUser } from "@/lib/auth";
import { conflict, handleRoute, json, notFound, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateUserSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/admin/users/:id — ADMIN only. Update role and/or name (AC12.1).
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handleRoute(async () => {
    await requireRole(req, Role.ADMIN);
    const { id } = await ctx.params;
    const input = updateUserSchema.parse(await readJson(req));

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw notFound("User not found");

    const user = await prisma.user.update({
      where: { id },
      data: { role: input.role, name: input.name },
    });
    return json({ user: toPublicUser(user) });
  });
}

// DELETE /api/admin/users/:id — ADMIN only.
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return handleRoute(async () => {
    await requireRole(req, Role.ADMIN);
    const { id } = await ctx.params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw notFound("User not found");

    try {
      await prisma.user.delete({ where: { id } });
    } catch (err) {
      // Author/editor FKs are RESTRICT — refuse to orphan their content.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2003"
      ) {
        throw conflict("User still owns articles or revisions");
      }
      throw err;
    }

    return new NextResponse(null, { status: 204 });
  });
}
