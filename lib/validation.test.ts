import { describe, expect, it } from "vitest";
import {
  createArticleSchema,
  paginationQuery,
  parseQuery,
  registerSchema,
  searchQuery,
} from "@/lib/validation";

describe("registerSchema", () => {
  it("accepts a valid payload and defaults role to undefined", () => {
    const v = registerSchema.parse({
      email: "a@b.dev",
      name: "Ann",
      password: "Password123!",
    });
    expect(v.email).toBe("a@b.dev");
  });
  it("rejects a short password", () => {
    expect(() =>
      registerSchema.parse({ email: "a@b.dev", name: "Ann", password: "x" })
    ).toThrow();
  });
  it("rejects unknown fields (strict)", () => {
    expect(() =>
      registerSchema.parse({
        email: "a@b.dev",
        name: "Ann",
        password: "Password123!",
        admin: true,
      })
    ).toThrow();
  });
});

describe("createArticleSchema", () => {
  it("defaults body and tagIds", () => {
    const v = createArticleSchema.parse({ title: "T" });
    expect(v.body).toBe("");
    expect(v.tagIds).toEqual([]);
  });
});

describe("query parsing", () => {
  it("coerces and defaults pagination", () => {
    const v = parseQuery(paginationQuery, new URLSearchParams(""));
    expect(v).toMatchObject({ page: 1, limit: 20 });
  });
  it("coerces provided values", () => {
    const v = parseQuery(
      paginationQuery,
      new URLSearchParams("page=3&limit=5&tag=x")
    );
    expect(v).toMatchObject({ page: 3, limit: 5, tag: "x" });
  });
  it("requires q for search", () => {
    expect(() => parseQuery(searchQuery, new URLSearchParams(""))).toThrow();
  });
});
