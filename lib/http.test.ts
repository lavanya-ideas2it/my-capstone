import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { handleRoute, readJson } from "@/lib/http";

// Build a minimal Request whose body is the given raw string.
function rawRequest(body: string, contentType = "application/json"): Request {
  return new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
}

describe("readJson", () => {
  it("parses a valid JSON body", async () => {
    const result = await readJson(rawRequest('{"key":"value"}'));
    expect(result).toEqual({ key: "value" });
  });

  it("throws 400 for malformed JSON (line 38)", async () => {
    await expect(readJson(rawRequest("{not valid}"))).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe("handleRoute", () => {
  it("passes through a successful response unchanged", async () => {
    const res = await handleRoute(async () =>
      NextResponse.json({ ok: true }, { status: 200 })
    );
    expect(res.status).toBe(200);
  });

  it("maps an unexpected thrown Error to 500 (lines 70-71)", async () => {
    const res = await handleRoute(async () => {
      throw new Error("something exploded");
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    // Must NOT leak the original message.
    expect(body.error).not.toContain("exploded");
  });

  it("maps a ZodError to 400", async () => {
    const res = await handleRoute(async () => {
      const { z } = await import("zod");
      z.string().min(10).parse("x");
      return NextResponse.json({});
    });
    expect(res.status).toBe(400);
  });
});
