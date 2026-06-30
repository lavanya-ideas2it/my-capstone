import { describe, expect, it } from "vitest";
import { diffLines, summarizeDiff } from "@/lib/diff";

describe("diffLines", () => {
  it("marks unchanged lines as eq", () => {
    const d = diffLines("a\nb", "a\nb");
    expect(d.every((l) => l.op === "eq")).toBe(true);
    expect(d).toHaveLength(2);
  });

  it("detects an added line", () => {
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
});

describe("summarizeDiff", () => {
  it("counts additions and deletions", () => {
    const { additions, deletions } = summarizeDiff("a\nb", "a\nb\nc\nd");
    expect(additions).toBe(2);
    expect(deletions).toBe(0);
  });
});
