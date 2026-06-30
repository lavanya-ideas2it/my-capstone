import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import {
  hashPassword,
  requireRole,
  toPublicUser,
} from "@/lib/auth";
import { conflict, handleRoute, json, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";

// POST /api/auth/register — ADMIN only, except the very first user (bootstrap).
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const input = registerSchema.parse(await readJson(req));

    const userCount = await prisma.user.count();
    let role: Role;
    if (userCount === 0) {
      // First-admin bootstrap: open, defaults to ADMIN (SPEC §2.2 footnote ¹).
      role = (input.role as Role | undefined) ?? Role.ADMIN;
    } else {
      await requireRole(req, Role.ADMIN);
      role = (input.role as Role | undefined) ?? Role.VIEWER;
    }

    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) throw conflict("Email already registered");

    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        role,
        passwordHash: await hashPassword(input.password),
      },
    });

    return json({ user: toPublicUser(user) }, 201);
  });
}
