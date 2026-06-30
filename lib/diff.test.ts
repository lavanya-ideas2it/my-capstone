import { describe, expect, it } from "vitest";
import { diffLines, summarizeDiff } from "@/lib/diff";

describe("diffLines", () => {
  it("marks unchanged lines as eq", () => {
    const d = diffLines("a\nb", "a\nb");
    expect(d.every((l) => l.op === "eq")).toBe(true);
    expect(d).toHaveLength(2);
  });

  it("detects an added line (appended)", () => {
    const d = diffLines("a\nb", "a\nb\nc");
    expect(d).toContainEqual({ op: "add", value: "c" });
  });

  it("detects a deleted line", () => {
    const d = diffLines("a\nb\nc", "a\nc");
    expect(d).toContainEqual({ op: "del", value: "b" });
  });

  it("handles a replacement as del + add", () => {
    const d = summarizeDiff("hello", "world");
    expect(d.additions).toBe(1);
    expect(d.deletions).toBe(1);
  });

  it("detects a line inserted in the middle (triggers add-branch of LCS traversal)", () => {
    // "a\nc" -> "a\nb\nc": b is inserted between a and c.
    // lcs[i+1][j] < lcs[i][j+1] → else branch (diff.ts lines 49-50).
    const d = diffLines("a\nc", "a\nb\nc");
    expect(d).toContainEqual({ op: "add", value: "b" });
    expect(d).toContainEqual({ op: "eq", value: "a" });
    expect(d).toContainEqual({ op: "eq", value: "c" });
    expect(d.filter((l) => l.op === "del")).toHaveLength(0);
  });

  it("handles empty from-string (all additions)", () => {
    const d = diffLines("", "a\nb");
    expect(d.every((l) => l.op === "add")).toBe(true);
    expect(d).toHaveLength(2);
  });

  it("handles empty to-string (all deletions)", () => {
    const d = diffLines("a\nb", "");
    expect(d.every((l) => l.op === "del")).toBe(true);
    expect(d).toHaveLength(2);
  });
});

describe("summarizeDiff", () => {
  it("counts additions and deletions", () => {
    const { additions, deletions } = summarizeDiff("a\nb", "a\nb\nc\nd");
    expect(additions).toBe(2);
    expect(deletions).toBe(0);
  });
});
