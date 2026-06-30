import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { handleRoute, json } from "@/lib/http";
import { listImportFiles } from "@/lib/mcp";

// GET /api/import/list — EDITOR+. Lists available .md files in the MCP import
// root so the UI can show a file picker before triggering POST /api/import.
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireRole(req, Role.EDITOR);
    const files = await listImportFiles();
    return json({ files });
  });
}
