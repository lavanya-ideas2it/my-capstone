import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as importDocs } from "@/app/api/import/route";
import { createUser, makeRequest, prisma, resetDb } from "@/tests/helpers";

let root: string;

beforeEach(async () => {
  await resetDb();
  root = await mkdtemp(join(tmpdir(), "twimport-"));
  process.env.IMPORT_ROOT = root;
});

async function writeDoc(name: string, contents: string) {
  await writeFile(join(root, name), contents, "utf8");
}

describe("POST /api/import", () => {
  it("403 for a viewer (importer is EDITOR-level)", async () => {
    const viewer = await createUser(Role.VIEWER);
    const res = await importDocs(
      makeRequest("/api/import", {
        method: "POST",
        token: viewer.token,
        body: { files: ["a.md"] },
      })
    );
    expect(res.status).toBe(403);
  });

  it("creates an article per file, with front-matter title + tags (AC13.1)", async () => {
    const editor = await createUser(Role.EDITOR);
    await writeDoc(
      "guide.md",
      "---\ntitle: Deployment Guide\ntags: DevOps, Process\n---\n# Deploy\nSteps here."
    );
    await writeDoc("plain.md", "Just body, title from filename.");

    const res = await importDocs(
      makeRequest("/api/import", {
        method: "POST",
        token: editor.token,
        body: { files: ["guide.md", "plain.md"] },
      })
    );
    expect(res.status).toBe(201);
    const { created, skipped } = await res.json();
    expect(created).toHaveLength(2);
    expect(skipped).toHaveLength(0);

    const guide = await prisma.article.findUnique({
      where: { slug: "deployment-guide" },
      include: { tags: true, currentRevision: true },
    });
    expect(guide?.title).toBe("Deployment Guide");
    expect(guide?.tags.map((t) => t.name).sort()).toEqual(["DevOps", "Process"]);
    expect(guide?.currentRevision?.version).toBe(1);

    // filename-derived title
    expect(
      await prisma.article.findUnique({ where: { slug: "plain" } })
    ).toBeTruthy();
  });

  it("skips and reports duplicate slugs (AC13.2)", async () => {
    const editor = await createUser(Role.EDITOR);
    await writeDoc("dup.md", "---\ntitle: Same Title\n---\nbody");
    await prisma.article.create({
      data: {
        slug: "same-title",
        title: "Same Title",
        body: "existing",
        authorId: editor.user.id,
      },
    });

    const res = await importDocs(
      makeRequest("/api/import", {
        method: "POST",
        token: editor.token,
        body: { files: ["dup.md"] },
      })
    );
    expect(res.status).toBe(201);
    const { created, skipped } = await res.json();
    expect(created).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].file).toBe("dup.md");
  });

  it("rejects path traversal outside the import root (AC13.3)", async () => {
    const editor = await createUser(Role.EDITOR);
    const res = await importDocs(
      makeRequest("/api/import", {
        method: "POST",
        token: editor.token,
        body: { files: ["../../etc/passwd"] },
      })
    );
    expect(res.status).toBe(400);
  });

  it("400 with an empty files list", async () => {
    const editor = await createUser(Role.EDITOR);
    const res = await importDocs(
      makeRequest("/api/import", {
        method: "POST",
        token: editor.token,
        body: { files: [] },
      })
    );
    expect(res.status).toBe(400);
  });

  it("401 when anonymous", async () => {
    const res = await importDocs(
      makeRequest("/api/import", { method: "POST", body: { files: ["a.md"] } })
    );
    expect(res.status).toBe(401);
  });
});
