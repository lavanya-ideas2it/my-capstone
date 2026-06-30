import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as listUsers } from "@/app/api/admin/users/route";
import {
  DELETE as deleteUser,
  PATCH as patchUser,
} from "@/app/api/admin/users/[id]/route";
import { createUser, makeRequest, params, prisma, resetDb } from "@/tests/helpers";

beforeEach(resetDb);

describe("GET /api/admin/users", () => {
  it("200 for admin, never leaking password hashes", async () => {
    const admin = await createUser(Role.ADMIN);
    await createUser(Role.EDITOR);
    const res = await listUsers(
      makeRequest("/api/admin/users", { token: admin.token })
    );
    expect(res.status).toBe(200);
    const { users } = await res.json();
    expect(users).toHaveLength(2);
    expect(users[0]).not.toHaveProperty("passwordHash");
  });

  it("403 for a non-admin (AC12.2)", async () => {
    const editor = await createUser(Role.EDITOR);
    const res = await listUsers(
      makeRequest("/api/admin/users", { token: editor.token })
    );
    expect(res.status).toBe(403);
  });

  it("401 when anonymous", async () => {
    const res = await listUsers(makeRequest("/api/admin/users"));
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/admin/users/:id", () => {
  it("changes a user's role (AC12.1)", async () => {
    const admin = await createUser(Role.ADMIN);
    const target = await createUser(Role.VIEWER);
    const res = await patchUser(
      makeRequest(`/api/admin/users/${target.user.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { role: "EDITOR" },
      }),
      params({ id: target.user.id })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).user.role).toBe("EDITOR");
  });

  it("404 for an unknown id", async () => {
    const admin = await createUser(Role.ADMIN);
    const res = await patchUser(
      makeRequest("/api/admin/users/nope", {
        method: "PATCH",
        token: admin.token,
        body: { name: "X" },
      }),
      params({ id: "nope" })
    );
    expect(res.status).toBe(404);
  });

  it("400 on an empty body", async () => {
    const admin = await createUser(Role.ADMIN);
    const target = await createUser(Role.VIEWER);
    const res = await patchUser(
      makeRequest(`/api/admin/users/${target.user.id}`, {
        method: "PATCH",
        token: admin.token,
        body: {},
      }),
      params({ id: target.user.id })
    );
    expect(res.status).toBe(400);
  });

  it("403 for a non-admin", async () => {
    const editor = await createUser(Role.EDITOR);
    const target = await createUser(Role.VIEWER);
    const res = await patchUser(
      makeRequest(`/api/admin/users/${target.user.id}`, {
        method: "PATCH",
        token: editor.token,
        body: { role: "ADMIN" },
      }),
      params({ id: target.user.id })
    );
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/admin/users/:id", () => {
  it("204 for admin deleting a user with no content", async () => {
    const admin = await createUser(Role.ADMIN);
    const target = await createUser(Role.VIEWER);
    const res = await deleteUser(
      makeRequest(`/api/admin/users/${target.user.id}`, {
        method: "DELETE",
        token: admin.token,
      }),
      params({ id: target.user.id })
    );
    expect(res.status).toBe(204);
    expect(await prisma.user.count()).toBe(1);
  });

  it("409 when the user still owns articles (FK restrict)", async () => {
    const admin = await createUser(Role.ADMIN);
    const author = await createUser(Role.EDITOR);
    await prisma.article.create({
      data: {
        slug: "owned",
        title: "Owned",
        body: "x",
        authorId: author.user.id,
      },
    });
    const res = await deleteUser(
      makeRequest(`/api/admin/users/${author.user.id}`, {
        method: "DELETE",
        token: admin.token,
      }),
      params({ id: author.user.id })
    );
    expect(res.status).toBe(409);
  });

  it("403 for a non-admin", async () => {
    const editor = await createUser(Role.EDITOR);
    const target = await createUser(Role.VIEWER);
    const res = await deleteUser(
      makeRequest(`/api/admin/users/${target.user.id}`, {
        method: "DELETE",
        token: editor.token,
      }),
      params({ id: target.user.id })
    );
    expect(res.status).toBe(403);
  });
});
