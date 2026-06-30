// Shared test utilities for the API integration suite.
//   - resetDb(): truncate every table between tests (each test owns its data).
//   - createUser(): seed a user of a given role + a ready-to-use access token.
//   - makeRequest()/params(): build NextRequest + route ctx for direct handler calls.
import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { hashPassword, signAccessToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export { prisma };

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "Session", "Revision", "Article", "Tag", "User", "_ArticleTags" RESTART IDENTITY CASCADE`
  );
}

let userCounter = 0;

export type SeededUser = {
  user: { id: string; email: string; name: string; role: Role };
  password: string;
  token: string;
};

export async function createUser(
  role: Role = Role.VIEWER,
  overrides: { email?: string; name?: string; password?: string } = {}
): Promise<SeededUser> {
  userCounter += 1;
  const password = overrides.password ?? "Password123!";
  const email =
    overrides.email ?? `u${userCounter}.${role.toLowerCase()}@test.dev`;
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      name: overrides.name ?? `Test ${role}`,
      role,
      passwordHash,
    },
    select: { id: true, email: true, name: true, role: true },
  });
  const token = await signAccessToken(user);
  return { user, password, token };
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string;
  cookies?: Record<string, string>;
};

export function makeRequest(
  path: string,
  { method = "GET", body, token, cookies }: RequestOptions = {}
): NextRequest {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);

  const init: { method: string; headers: Headers; body?: string } = {
    method,
    headers,
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  const req = new NextRequest(new URL(path, "http://localhost"), init);
  if (cookies) {
    for (const [name, value] of Object.entries(cookies)) {
      req.cookies.set(name, value);
    }
  }
  return req;
}

/** Build the second argument Next 15 passes to dynamic route handlers. */
export function params<T extends Record<string, string>>(
  values: T
): { params: Promise<T> } {
  return { params: Promise.resolve(values) };
}
