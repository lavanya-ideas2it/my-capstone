import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });
  it("collapses non-alphanumerics and trims edges", () => {
    expect(slugify("  Foo --- Bar!!  ")).toBe("foo-bar");
  });
  it("strips diacritics", () => {
    expect(slugify("Café Déjà")).toBe("cafe-deja");
  });
  it("returns empty string for symbols-only input", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("uniqueSlug", () => {
  it("returns the base when free", () => {
    expect(uniqueSlug("guide", [])).toBe("guide");
  });
  it("suffixes on collision (AC4.3)", () => {
    expect(uniqueSlug("guide", ["guide"])).toBe("guide-2");
    expect(uniqueSlug("guide", ["guide", "guide-2"])).toBe("guide-3");
  });
  it("falls back to 'untitled' for an empty base", () => {
    expect(uniqueSlug("", [])).toBe("untitled");
  });
});
