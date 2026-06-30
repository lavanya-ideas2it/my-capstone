import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as listTags, POST as createTag } from "@/app/api/tags/route";
import {
  DELETE as deleteTag,
  PUT as updateTag,
} from "@/app/api/tags/[id]/route";
import { createUser, makeRequest, params, prisma, resetDb } from "@/tests/helpers";

beforeEach(resetDb);

async function seedTag(name = "Engineering") {
  return prisma.tag.create({
    data: { name, slug: name.toLowerCase() },
  });
}

describe("GET /api/tags", () => {
  it("401 when anonymous", async () => {
    const res = await listTags(makeRequest("/api/tags"));
    expect(res.status).toBe(401);
  });

  it("200 with tags and article counts for a viewer", async () => {
    const viewer = await createUser(Role.VIEWER);
    await seedTag("Engineering");
    await seedTag("Security");
    const res = await listTags(makeRequest("/api/tags", { token: viewer.token }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tags).toHaveLength(2);
    expect(body.tags[0]).toHaveProperty("articleCount");
  });
});

describe("POST /api/tags", () => {
  it("403 for a viewer", async () => {
    const viewer = await createUser(Role.VIEWER);
    const res = await createTag(
      makeRequest("/api/tags", {
        method: "POST",
        token: viewer.token,
        body: { name: "New" },
      })
    );
    expect(res.status).toBe(403);
  });

  it("201 for an editor, deriving a slug", async () => {
    const editor = await createUser(Role.EDITOR);
    const res = await createTag(
      makeRequest("/api/tags", {
        method: "POST",
        token: editor.token,
        body: { name: "Dev Ops" },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.tag.slug).toBe("dev-ops");
  });

  it("409 on a duplicate name", async () => {
    const editor = await createUser(Role.EDITOR);
    await seedTag("Engineering");
    const res = await createTag(
      makeRequest("/api/tags", {
        method: "POST",
        token: editor.token,
        body: { name: "Engineering" },
      })
    );
    expect(res.status).toBe(409);
  });

  it("400 on an empty name", async () => {
    const editor = await createUser(Role.EDITOR);
    const res = await createTag(
      makeRequest("/api/tags", {
        method: "POST",
        token: editor.token,
        body: { name: "" },
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/tags/:id", () => {
  it("200 when an editor renames", async () => {
    const editor = await createUser(Role.EDITOR);
    const tag = await seedTag("Old");
    const res = await updateTag(
      makeRequest(`/api/tags/${tag.id}`, {
        method: "PUT",
        token: editor.token,
        body: { name: "Brand New" },
      }),
      params({ id: tag.id })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tag.name).toBe("Brand New");
    expect(body.tag.slug).toBe("brand-new");
  });

  it("404 for an unknown id", async () => {
    const editor = await createUser(Role.EDITOR);
    const res = await updateTag(
      makeRequest("/api/tags/nope", {
        method: "PUT",
        token: editor.token,
        body: { name: "X" },
      }),
      params({ id: "nope" })
    );
    expect(res.status).toBe(404);
  });

  it("403 for a viewer", async () => {
    const viewer = await createUser(Role.VIEWER);
    const tag = await seedTag("Old");
    const res = await updateTag(
      makeRequest(`/api/tags/${tag.id}`, {
        method: "PUT",
        token: viewer.token,
        body: { name: "X" },
      }),
      params({ id: tag.id })
    );
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/tags/:id", () => {
  it("403 for an editor (admin-only, AC10.2)", async () => {
    const editor = await createUser(Role.EDITOR);
    const tag = await seedTag("Old");
    const res = await deleteTag(
      makeRequest(`/api/tags/${tag.id}`, {
        method: "DELETE",
        token: editor.token,
      }),
      params({ id: tag.id })
    );
    expect(res.status).toBe(403);
  });

  it("204 for an admin", async () => {
    const admin = await createUser(Role.ADMIN);
    const tag = await seedTag("Old");
    const res = await deleteTag(
      makeRequest(`/api/tags/${tag.id}`, {
        method: "DELETE",
        token: admin.token,
      }),
      params({ id: tag.id })
    );
    expect(res.status).toBe(204);
    expect(await prisma.tag.count()).toBe(0);
  });

  it("404 for an unknown id", async () => {
    const admin = await createUser(Role.ADMIN);
    const res = await deleteTag(
      makeRequest("/api/tags/nope", {
        method: "DELETE",
        token: admin.token,
      }),
      params({ id: "nope" })
    );
    expect(res.status).toBe(404);
  });
});
