import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import { GET as listFiles } from "@/app/api/import/list/route";
import { createUser, makeRequest, resetDb } from "@/tests/helpers";

// Isolate the API test from the actual MCP server process.
vi.mock("@/lib/mcp", () => ({
  listImportFiles: vi.fn().mockResolvedValue([
    "onboarding-guide.md",
    "api-conventions.md",
  ]),
}));

beforeEach(resetDb);

describe("GET /api/import/list", () => {
  it("401 when anonymous", async () => {
    const res = await listFiles(makeRequest("/api/import/list"));
    expect(res.status).toBe(401);
  });

  it("403 for a viewer (VIEWER < EDITOR)", async () => {
    const viewer = await createUser(Role.VIEWER);
    const res = await listFiles(
      makeRequest("/api/import/list", { token: viewer.token })
    );
    expect(res.status).toBe(403);
  });

  it("200 with the file list for an editor", async () => {
    const editor = await createUser(Role.EDITOR);
    const res = await listFiles(
      makeRequest("/api/import/list", { token: editor.token })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.files).toEqual(["onboarding-guide.md", "api-conventions.md"]);
  });

  it("200 with the file list for an admin", async () => {
    const admin = await createUser(Role.ADMIN);
    const res = await listFiles(
      makeRequest("/api/import/list", { token: admin.token })
    );
    expect(res.status).toBe(200);
  });
});
