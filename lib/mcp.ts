// MCP filesystem client (SPEC §3).
//
// Spawns @modelcontextprotocol/server-filesystem as a child process via the
// stdio transport. The server is scoped to IMPORT_ROOT and rejects any path
// outside it — the same safety guarantee as lib/import.ts (AC13.3).
//
// Each call opens a fresh connection, does its work, then closes it.
// This keeps the API routes stateless and avoids orphaned processes.
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const SERVER_BIN = path.resolve(
  process.cwd(),
  "node_modules/@modelcontextprotocol/server-filesystem/dist/index.js"
);

function importRoot(): string {
  return path.resolve(process.env.IMPORT_ROOT ?? "./import-docs");
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const root = importRoot();
  const transport = new StdioClientTransport({
    command: "node",
    args: [SERVER_BIN, root],
  });
  const client = new Client({ name: "teamwiki-importer", version: "1.0.0" });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

/** List all .md files in the import root using the MCP filesystem server. */
export async function listImportFiles(): Promise<string[]> {
  return withClient(async (client) => {
    const root = importRoot();
    const result = await client.callTool({
      name: "list_directory",
      arguments: { path: root },
    });

    // Tool returns [{ type: "text", text: "[FILE] a.md\n[DIR] sub\n..." }]
    type TextBlock = { type: string; text: string };
    const blocks = result.content as TextBlock[];
    const text = blocks.find((b) => b.type === "text")?.text ?? "";

    return text
      .split("\n")
      .filter((line) => line.startsWith("[FILE] ") && line.endsWith(".md"))
      .map((line) => line.slice("[FILE] ".length));
  });
}

/** Read the raw content of one file in the import root via MCP. */
export async function readImportFile(filename: string): Promise<string> {
  return withClient(async (client) => {
    const filePath = path.join(importRoot(), filename);
    const result = await client.callTool({
      name: "read_file",
      arguments: { path: filePath },
    });

    type TextBlock = { type: string; text: string };
    const blocks = result.content as TextBlock[];
    return blocks.find((b) => b.type === "text")?.text ?? "";
  });
}
