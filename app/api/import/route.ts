import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { handleRoute, json, readJson } from "@/lib/http";
import { importFiles } from "@/lib/import";
import { importSchema } from "@/lib/validation";

// POST /api/import — EDITOR+. Bulk-import local Markdown docs (SPEC §3 / US-13).
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const user = await requireRole(req, Role.EDITOR);
    const { files } = importSchema.parse(await readJson(req));
    const report = await importFiles(user.id, files);
    return json(report, 201);
  });
}
