import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  hashPassword,
  requireRole,
  requireUser,
  signAccessToken,
  verifyAccessToken,
  verifyPassword,
} from "@/lib/auth";
import { HttpError } from "@/lib/http";

const user = { id: "u1", email: "a@b.dev", role: Role.EDITOR };

function reqWith(token?: string): Request {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request("http://localhost/api/x", { headers });
}

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("Password123!");
    expect(hash).not.toContain("Password123!");
    expect(await verifyPassword(hash, "Password123!")).toBe(true);
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });
});

describe("access tokens", () => {
  it("round-trips claims", async () => {
    const token = await signAccessToken(user);
    const claims = await verifyAccessToken(token);
    expect(claims).toEqual(user);
  });
  it("rejects a garbage token", async () => {
    await expect(verifyAccessToken("not-a-jwt")).rejects.toBeDefined();
  });
});

describe("requireUser", () => {
  it("returns the user for a valid token", async () => {
    const token = await signAccessToken(user);
    await expect(requireUser(reqWith(token))).resolves.toEqual(user);
  });
  it("throws 401 when no token is present", async () => {
    await expect(requireUser(reqWith())).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe("requireRole", () => {
  it("allows an equal or higher role", async () => {
    const token = await signAccessToken({ ...user, role: Role.ADMIN });
    await expect(requireRole(reqWith(token), Role.EDITOR)).resolves.toMatchObject(
      { role: Role.ADMIN }
    );
  });
  it("forbids a lower role with 403", async () => {
    const token = await signAccessToken({ ...user, role: Role.VIEWER });
    await expect(
      requireRole(reqWith(token), Role.EDITOR)
    ).rejects.toMatchObject({ status: 403 });
  });
  it("throws HttpError (401) before role is even checked when anonymous", async () => {
    const err = await requireRole(reqWith(), Role.VIEWER).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(401);
  });
});
