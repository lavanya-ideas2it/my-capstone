import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import {
  GET as listArticles,
  POST as createArticle,
} from "@/app/api/articles/route";
import {
  DELETE as deleteArticle,
  GET as getArticle,
  PUT as updateArticle,
} from "@/app/api/articles/[id]/route";
import { createUser, makeRequest, params, prisma, resetDb } from "@/tests/helpers";

beforeEach(resetDb);

async function makeTag(name: string) {
  return prisma.tag.create({ data: { name, slug: name.toLowerCase() } });
}

async function createViaApi(
  token: string,
  body: Record<string, unknown>
) {
  const res = await createArticle(
    makeRequest("/api/articles", { method: "POST", token, body })
  );
  return res;
}

describe("POST /api/articles", () => {
  it("403 for a viewer (AC4.2)", async () => {
    const viewer = await createUser(Role.VIEWER);
    const res = await createViaApi(viewer.token, { title: "T", body: "b" });
    expect(res.status).toBe(403);
  });

  it("201 with a v1 revision and slug from the title (AC4.1)", async () => {
    const editor = await createUser(Role.EDITOR);
    const tag = await makeTag("eng");
    const res = await createViaApi(editor.token, {
      title: "Hello World",
      body: "# Hi",
      tagIds: [tag.id],
    });
    expect(res.status).toBe(201);
    const { article } = await res.json();
    expect(article.slug).toBe("hello-world");
    expect(article.currentRevision.version).toBe(1);

    const revs = await prisma.revision.count({
      where: { articleId: article.id },
    });
    expect(revs).toBe(1);
  });

  it("de-duplicates a colliding slug instead of failing (AC4.3)", async () => {
    const editor = await createUser(Role.EDITOR);
    const a = await createViaApi(editor.token, { title: "Guide", body: "x" });
    const b = await createViaApi(editor.token, { title: "Guide", body: "y" });
    expect(b.status).toBe(201);
    expect((await a.json()).article.slug).toBe("guide");
    expect((await b.json()).article.slug).toBe("guide-2");
  });

  it("400 on a missing title", async () => {
    const editor = await createUser(Role.EDITOR);
    const res = await createViaApi(editor.token, { body: "x" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/articles/:id", () => {
  it("200 with article, tags and current revision (AC5.1)", async () => {
    const editor = await createUser(Role.EDITOR);
    const tag = await makeTag("eng");
    const created = await (
      await createViaApi(editor.token, {
        title: "Doc",
        body: "body",
        tagIds: [tag.id],
      })
    ).json();

    const res = await getArticle(
      makeRequest(`/api/articles/${created.article.id}`, {
        token: editor.token,
      }),
      params({ id: created.article.id })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.article.title).toBe("Doc");
    expect(body.tags).toHaveLength(1);
    expect(body.currentRevision.version).toBe(1);
  });

  it("404 for an unknown id", async () => {
    const viewer = await createUser(Role.VIEWER);
    const res = await getArticle(
      makeRequest("/api/articles/nope", { token: viewer.token }),
      params({ id: "nope" })
    );
    expect(res.status).toBe(404);
  });

  it("401 when anonymous", async () => {
    const res = await getArticle(
      makeRequest("/api/articles/x"),
      params({ id: "x" })
    );
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/articles/:id", () => {
  async function seedArticle(token: string) {
    const created = await (
      await createViaApi(token, { title: "Original", body: "v1 body" })
    ).json();
    return created.article;
  }

  it("appends revisions and advances currentRevisionId (AC6.1)", async () => {
    const editor = await createUser(Role.EDITOR);
    const article = await seedArticle(editor.token);

    const r2 = await updateArticle(
      makeRequest(`/api/articles/${article.id}`, {
        method: "PUT",
        token: editor.token,
        body: { body: "v2 body", changeSummary: "second" },
      }),
      params({ id: article.id })
    );
    expect(r2.status).toBe(200);
    expect((await r2.json()).article.currentRevision.version).toBe(2);

    const r3 = await updateArticle(
      makeRequest(`/api/articles/${article.id}`, {
        method: "PUT",
        token: editor.token,
        body: { title: "Original v3" },
      }),
      params({ id: article.id })
    );
    expect((await r3.json()).article.currentRevision.version).toBe(3);

    const count = await prisma.revision.count({
      where: { articleId: article.id },
    });
    expect(count).toBe(3);
  });

  it("rolls back atomically on a bad tag id — no partial write (AC6.2)", async () => {
    const editor = await createUser(Role.EDITOR);
    const article = await seedArticle(editor.token);

    const res = await updateArticle(
      makeRequest(`/api/articles/${article.id}`, {
        method: "PUT",
        token: editor.token,
        body: { title: "Should not persist", tagIds: ["does-not-exist"] },
      }),
      params({ id: article.id })
    );
    expect(res.status).toBe(400);

    // Neither the article body/title nor a new revision was written.
    const fresh = await prisma.article.findUnique({
      where: { id: article.id },
    });
    expect(fresh?.title).toBe("Original");
    expect(await prisma.revision.count({ where: { articleId: article.id } })).toBe(
      1
    );
  });

  it("403 for a viewer", async () => {
    const editor = await createUser(Role.EDITOR);
    const viewer = await createUser(Role.VIEWER);
    const article = await seedArticle(editor.token);
    const res = await updateArticle(
      makeRequest(`/api/articles/${article.id}`, {
        method: "PUT",
        token: viewer.token,
        body: { body: "nope" },
      }),
      params({ id: article.id })
    );
    expect(res.status).toBe(403);
  });

  it("404 for an unknown id", async () => {
    const editor = await createUser(Role.EDITOR);
    const res = await updateArticle(
      makeRequest("/api/articles/nope", {
        method: "PUT",
        token: editor.token,
        body: { body: "x" },
      }),
      params({ id: "nope" })
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/articles (list)", () => {
  it("paginates and filters by tag", async () => {
    const editor = await createUser(Role.EDITOR);
    const tag = await makeTag("eng");
    await createViaApi(editor.token, {
      title: "Tagged",
      body: "x",
      tagIds: [tag.id],
    });
    await createViaApi(editor.token, { title: "Untagged", body: "y" });

    const all = await listArticles(
      makeRequest("/api/articles", { token: editor.token })
    );
    expect((await all.json()).total).toBe(2);

    const filtered = await listArticles(
      makeRequest("/api/articles?tag=eng", { token: editor.token })
    );
    const body = await filtered.json();
    expect(body.total).toBe(1);
    expect(body.items[0].title).toBe("Tagged");
  });

  it("401 when anonymous", async () => {
    const res = await listArticles(makeRequest("/api/articles"));
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/articles/:id", () => {
  it("403 for an editor, 204 for an admin and cascades revisions (AC7.1)", async () => {
    const editor = await createUser(Role.EDITOR);
    const admin = await createUser(Role.ADMIN);
    const created = await (
      await createViaApi(editor.token, { title: "Doomed", body: "x" })
    ).json();
    const id = created.article.id;

    const forbidden = await deleteArticle(
      makeRequest(`/api/articles/${id}`, {
        method: "DELETE",
        token: editor.token,
      }),
      params({ id })
    );
    expect(forbidden.status).toBe(403);

    const ok = await deleteArticle(
      makeRequest(`/api/articles/${id}`, {
        method: "DELETE",
        token: admin.token,
      }),
      params({ id })
    );
    expect(ok.status).toBe(204);
    expect(await prisma.article.count()).toBe(0);
    expect(await prisma.revision.count()).toBe(0);
  });
});
