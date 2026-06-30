import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as createArticle } from "@/app/api/articles/route";
import { PUT as updateArticle } from "@/app/api/articles/[id]/route";
import { GET as listRevisions } from "@/app/api/articles/[id]/revisions/route";
import { GET as getRevision } from "@/app/api/articles/[id]/revisions/[revId]/route";
import { GET as getDiff } from "@/app/api/articles/[id]/diff/route";
import { createUser, makeRequest, params, prisma, resetDb } from "@/tests/helpers";

beforeEach(resetDb);

// Create an article and edit it twice → versions 1,2,3.
async function seedThreeVersions(token: string) {
  const created = await (
    await createArticle(
      makeRequest("/api/articles", {
        method: "POST",
        token,
        body: { title: "Doc", body: "line one" },
      })
    )
  ).json();
  const id = created.article.id;
  await updateArticle(
    makeRequest(`/api/articles/${id}`, {
      method: "PUT",
      token,
      body: { body: "line one\nline two", changeSummary: "add line two" },
    }),
    params({ id })
  );
  await updateArticle(
    makeRequest(`/api/articles/${id}`, {
      method: "PUT",
      token,
      body: { body: "line one\nline two\nline three" },
    }),
    params({ id })
  );
  return id;
}

describe("GET /api/articles/:id/revisions", () => {
  it("lists revisions newest-first with metadata (AC8.1)", async () => {
    const editor = await createUser(Role.EDITOR);
    const id = await seedThreeVersions(editor.token);

    const res = await listRevisions(
      makeRequest(`/api/articles/${id}/revisions`, { token: editor.token }),
      params({ id })
    );
    expect(res.status).toBe(200);
    const { revisions } = await res.json();
    expect(revisions.map((r: { version: number }) => r.version)).toEqual([
      3, 2, 1,
    ]);
    expect(revisions[0]).toHaveProperty("editor");
    expect(revisions[0]).toHaveProperty("createdAt");
    expect(revisions[1].changeSummary).toBe("add line two");
  });

  it("404 for an unknown article", async () => {
    const viewer = await createUser(Role.VIEWER);
    const res = await listRevisions(
      makeRequest("/api/articles/nope/revisions", { token: viewer.token }),
      params({ id: "nope" })
    );
    expect(res.status).toBe(404);
  });

  it("401 when anonymous", async () => {
    const res = await listRevisions(
      makeRequest("/api/articles/x/revisions"),
      params({ id: "x" })
    );
    expect(res.status).toBe(401);
  });
});

describe("GET /api/articles/:id/revisions/:revId", () => {
  it("200 with a single revision", async () => {
    const editor = await createUser(Role.EDITOR);
    const id = await seedThreeVersions(editor.token);
    const rev = await prisma.revision.findFirst({
      where: { articleId: id, version: 2 },
    });

    const res = await getRevision(
      makeRequest(`/api/articles/${id}/revisions/${rev!.id}`, {
        token: editor.token,
      }),
      params({ id, revId: rev!.id })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).revision.version).toBe(2);
  });

  it("404 when the revision belongs to another article", async () => {
    const editor = await createUser(Role.EDITOR);
    const id = await seedThreeVersions(editor.token);
    const other = await seedThreeVersions(editor.token);
    const otherRev = await prisma.revision.findFirst({
      where: { articleId: other },
    });

    const res = await getRevision(
      makeRequest(`/api/articles/${id}/revisions/${otherRev!.id}`, {
        token: editor.token,
      }),
      params({ id, revId: otherRev!.id })
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/articles/:id/diff", () => {
  it("computes additions/deletions between two versions (AC9.1)", async () => {
    const editor = await createUser(Role.EDITOR);
    const id = await seedThreeVersions(editor.token);

    const res = await getDiff(
      makeRequest(`/api/articles/${id}/diff?from=1&to=3`, {
        token: editor.token,
      }),
      params({ id })
    );
    expect(res.status).toBe(200);
    const { diff, from, to } = await res.json();
    expect(from).toBe(1);
    expect(to).toBe(3);
    expect(diff.additions).toBe(2); // "line two", "line three"
    expect(diff.deletions).toBe(0);
  });

  it("404 when a requested version does not exist", async () => {
    const editor = await createUser(Role.EDITOR);
    const id = await seedThreeVersions(editor.token);
    const res = await getDiff(
      makeRequest(`/api/articles/${id}/diff?from=1&to=99`, {
        token: editor.token,
      }),
      params({ id })
    );
    expect(res.status).toBe(404);
  });

  it("400 when query params are missing/invalid", async () => {
    const editor = await createUser(Role.EDITOR);
    const id = await seedThreeVersions(editor.token);
    const res = await getDiff(
      makeRequest(`/api/articles/${id}/diff?from=abc`, {
        token: editor.token,
      }),
      params({ id })
    );
    expect(res.status).toBe(400);
  });
});
