import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as createArticle } from "@/app/api/articles/route";
import { GET as search } from "@/app/api/search/route";
import { createUser, makeRequest, resetDb } from "@/tests/helpers";

beforeEach(resetDb);

async function create(token: string, title: string, body: string) {
  return createArticle(
    makeRequest("/api/articles", {
      method: "POST",
      token,
      body: { title, body },
    })
  );
}

describe("GET /api/search", () => {
  it("401 when anonymous", async () => {
    const res = await search(makeRequest("/api/search?q=hello"));
    expect(res.status).toBe(401);
  });

  it("400 when q is missing", async () => {
    const viewer = await createUser(Role.VIEWER);
    const res = await search(makeRequest("/api/search", { token: viewer.token }));
    expect(res.status).toBe(400);
  });

  it("ranks a title match above a body-only match (AC11.1)", async () => {
    const editor = await createUser(Role.EDITOR);
    await create(editor.token, "PostgreSQL Tutorial", "Some generic content.");
    await create(
      editor.token,
      "Generic Notes",
      "An aside mentioning postgresql once in the body."
    );
    await create(editor.token, "Unrelated", "Nothing to see here.");

    const res = await search(
      makeRequest("/api/search?q=postgresql", { token: editor.token })
    );
    expect(res.status).toBe(200);
    const { items, total } = await res.json();
    expect(total).toBe(2);
    expect(items[0].title).toBe("PostgreSQL Tutorial"); // title weighted 'A'
    // ranks are descending
    expect(items[0].rank).toBeGreaterThanOrEqual(items[1].rank);
  });

  it("returns a highlighted snippet", async () => {
    const editor = await createUser(Role.EDITOR);
    await create(
      editor.token,
      "Indexing",
      "The quick brown fox jumps over the lazy dog repeatedly."
    );
    const res = await search(
      makeRequest("/api/search?q=brown fox", { token: editor.token })
    );
    const { items } = await res.json();
    expect(items[0].snippet).toContain("<mark>");
  });

  it("supports multi-word queries (websearch semantics, AC11.3)", async () => {
    const editor = await createUser(Role.EDITOR);
    await create(editor.token, "Search Performance", "tsvector and gin indexes");
    const res = await search(
      makeRequest("/api/search?q=gin indexes", { token: editor.token })
    );
    const { total } = await res.json();
    expect(total).toBe(1);
  });
});
