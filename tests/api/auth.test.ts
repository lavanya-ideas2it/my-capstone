import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as refresh } from "@/app/api/auth/refresh/route";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { REFRESH_COOKIE } from "@/lib/auth";
import { createUser, makeRequest, prisma, resetDb } from "@/tests/helpers";

beforeEach(resetDb);

describe("POST /api/auth/register", () => {
  it("bootstraps the first user without auth (201)", async () => {
    const res = await register(
      makeRequest("/api/auth/register", {
        method: "POST",
        body: {
          email: "boot@teamwiki.dev",
          name: "Boot Admin",
          password: "Password123!",
          role: "ADMIN",
        },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.email).toBe("boot@teamwiki.dev");
    expect(body.user).not.toHaveProperty("passwordHash");
  });

  it("rejects an anonymous register once users exist (401)", async () => {
    // Bootstrap is closed once a user exists; an unauthenticated caller is
    // 401 (the 403 case is an authenticated non-admin, below).
    await createUser(Role.ADMIN);
    const res = await register(
      makeRequest("/api/auth/register", {
        method: "POST",
        body: { email: "x@y.dev", name: "X", password: "Password123!" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("rejects a non-admin caller (403)", async () => {
    await createUser(Role.ADMIN);
    const editor = await createUser(Role.EDITOR);
    const res = await register(
      makeRequest("/api/auth/register", {
        method: "POST",
        token: editor.token,
        body: { email: "x@y.dev", name: "X", password: "Password123!" },
      })
    );
    expect(res.status).toBe(403);
  });

  it("lets an admin create a user (201)", async () => {
    const admin = await createUser(Role.ADMIN);
    const res = await register(
      makeRequest("/api/auth/register", {
        method: "POST",
        token: admin.token,
        body: {
          email: "new@y.dev",
          name: "New",
          password: "Password123!",
          role: "EDITOR",
        },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.role).toBe("EDITOR");
  });

  it("409 on duplicate email", async () => {
    const admin = await createUser(Role.ADMIN, { email: "dup@y.dev" });
    const res = await register(
      makeRequest("/api/auth/register", {
        method: "POST",
        token: admin.token,
        body: { email: "dup@y.dev", name: "Dup", password: "Password123!" },
      })
    );
    expect(res.status).toBe(409);
  });

  it("400 on invalid body", async () => {
    await createUser(Role.ADMIN);
    const admin = await createUser(Role.ADMIN);
    const res = await register(
      makeRequest("/api/auth/register", {
        method: "POST",
        token: admin.token,
        body: { email: "not-an-email", name: "", password: "x" },
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("200 with accessToken + refresh cookie on valid credentials", async () => {
    const { user, password } = await createUser(Role.EDITOR, {
      email: "edie@y.dev",
    });
    const res = await login(
      makeRequest("/api/auth/login", {
        method: "POST",
        body: { email: user.email, password },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.accessToken).toBe("string");
    expect(body.user.email).toBe("edie@y.dev");
    expect(res.cookies.get(REFRESH_COOKIE)?.value).toBeTruthy();
    expect(await prisma.session.count()).toBe(1);
  });

  it("401 with a generic error on wrong password (AC1.2)", async () => {
    const { user } = await createUser(Role.VIEWER);
    const res = await login(
      makeRequest("/api/auth/login", {
        method: "POST",
        body: { email: user.email, password: "wrong-password" },
      })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid credentials/i);
  });

  it("401 for an unknown email (no user-existence hint)", async () => {
    const res = await login(
      makeRequest("/api/auth/login", {
        method: "POST",
        body: { email: "ghost@y.dev", password: "Password123!" },
      })
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/refresh", () => {
  async function loginAndGetCookie() {
    const { user, password } = await createUser(Role.EDITOR);
    const res = await login(
      makeRequest("/api/auth/login", {
        method: "POST",
        body: { email: user.email, password },
      })
    );
    return { user, cookie: res.cookies.get(REFRESH_COOKIE)!.value };
  }

  it("200 with a fresh access token for a valid cookie", async () => {
    const { cookie } = await loginAndGetCookie();
    const res = await refresh(
      makeRequest("/api/auth/refresh", {
        method: "POST",
        cookies: { [REFRESH_COOKIE]: cookie },
      })
    );
    expect(res.status).toBe(200);
    expect(typeof (await res.json()).accessToken).toBe("string");
  });

  it("401 when no refresh cookie is present", async () => {
    const res = await refresh(
      makeRequest("/api/auth/refresh", { method: "POST" })
    );
    expect(res.status).toBe(401);
  });

  it("rotates the token: the old cookie no longer works", async () => {
    const { cookie } = await loginAndGetCookie();
    await refresh(
      makeRequest("/api/auth/refresh", {
        method: "POST",
        cookies: { [REFRESH_COOKIE]: cookie },
      })
    );
    const res = await refresh(
      makeRequest("/api/auth/refresh", {
        method: "POST",
        cookies: { [REFRESH_COOKIE]: cookie },
      })
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the session and clears the cookie (AC2.1)", async () => {
    const { user, password } = await createUser(Role.EDITOR);
    const loginRes = await login(
      makeRequest("/api/auth/login", {
        method: "POST",
        body: { email: user.email, password },
      })
    );
    const cookie = loginRes.cookies.get(REFRESH_COOKIE)!.value;
    const accessToken = (await loginRes.json()).accessToken;

    const res = await logout(
      makeRequest("/api/auth/logout", {
        method: "POST",
        token: accessToken,
        cookies: { [REFRESH_COOKIE]: cookie },
      })
    );
    expect(res.status).toBe(204);

    // Subsequent refresh with the revoked cookie fails.
    const after = await refresh(
      makeRequest("/api/auth/refresh", {
        method: "POST",
        cookies: { [REFRESH_COOKIE]: cookie },
      })
    );
    expect(after.status).toBe(401);
  });

  it("401 without an access token", async () => {
    const res = await logout(
      makeRequest("/api/auth/logout", { method: "POST" })
    );
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("200 with the current user", async () => {
    const { user, token } = await createUser(Role.ADMIN);
    const res = await me(makeRequest("/api/auth/me", { token }));
    expect(res.status).toBe(200);
    expect((await res.json()).user.email).toBe(user.email);
  });

  it("401 without a token", async () => {
    const res = await me(makeRequest("/api/auth/me"));
    expect(res.status).toBe(401);
  });
});
