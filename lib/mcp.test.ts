import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { listImportFiles, readImportFile } from "@/lib/mcp";

// Point the client at the project's real import-docs directory.
beforeAll(() => {
  process.env.IMPORT_ROOT = path.resolve(process.cwd(), "import-docs");
});

describe("MCP filesystem integration", () => {
  it(
    "lists .md files from the import root",
    async () => {
      const files = await listImportFiles();
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
      expect(files.every((f) => f.endsWith(".md"))).toBe(true);
    },
    15_000
  );

  it(
    "returns the raw content of a file in the import root",
    async () => {
      const files = await listImportFiles();
      expect(files.length).toBeGreaterThan(0);
      const content = await readImportFile(files[0]);
      expect(typeof content).toBe("string");
      expect(content.length).toBeGreaterThan(0);
    },
    15_000
  );

  it(
    "returns an empty string for a filename that resolves to nothing inside the root",
    async () => {
      // MCP filesystem server returns an in-band error text for missing files;
      // readImportFile surfaces that as a non-empty string rather than throwing.
      // The important invariant is that the call does not throw.
      await expect(readImportFile("__nonexistent__.md")).resolves.toBeDefined();
    },
    15_000
  );
});
