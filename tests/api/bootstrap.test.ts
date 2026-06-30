import { beforeEach, describe, expect, it } from "vitest";
import { GET as bootstrap } from "@/app/api/auth/bootstrap/route";
import { createUser, resetDb } from "@/tests/helpers";
import { Role } from "@prisma/client";

beforeEach(resetDb);

describe("GET /api/auth/bootstrap", () => {
  it("returns needsBootstrap:true when no users exist", async () => {
    const res = await bootstrap();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.needsBootstrap).toBe(true);
  });

  it("returns needsBootstrap:false once a user exists", async () => {
    await createUser(Role.ADMIN);
    const res = await bootstrap();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.needsBootstrap).toBe(false);
  });

  it("requires no auth — anonymous can call it (200)", async () => {
    // Public endpoint; middleware doesn't gate it.
    const res = await bootstrap();
    expect(res.status).toBe(200);
  });
});
