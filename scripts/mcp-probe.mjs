/**
 * MCP connectivity probe — run with:
 *   node scripts/mcp-probe.mjs
 *
 * Shows: server handshake, tool list, directory listing, and one file read.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../import-docs");
const SERVER = path.resolve(__dirname, "../node_modules/@modelcontextprotocol/server-filesystem/dist/index.js");

const SEP = "─".repeat(60);

async function main() {
  console.log(SEP);
  console.log("TeamWiki — MCP Filesystem Server Probe");
  console.log(SEP);
  console.log(`Import root : ${ROOT}`);
  console.log(`Server bin  : ${SERVER}`);
  console.log();

  // ── 1. Connect ──────────────────────────────────────────────────────────────
  console.log("1. Connecting via StdioClientTransport …");
  const transport = new StdioClientTransport({
    command: "node",
    args: [SERVER, ROOT],
  });
  const client = new Client({ name: "mcp-probe", version: "1.0.0" });
  await client.connect(transport);
  console.log("   ✓ Connected\n");

  // ── 2. Server info ───────────────────────────────────────────────────────────
  const info = client.getServerVersion();
  console.log("2. Server info:");
  console.log(`   name    : ${info?.name ?? "(unknown)"}`);
  console.log(`   version : ${info?.version ?? "(unknown)"}\n`);

  // ── 3. List available tools ──────────────────────────────────────────────────
  console.log("3. Available tools:");
  const { tools } = await client.listTools();
  for (const t of tools) {
    console.log(`   • ${t.name}`);
  }
  console.log();

  // ── 4. list_directory ────────────────────────────────────────────────────────
  console.log(`4. Calling list_directory("${ROOT}") …`);
  const listResult = await client.callTool({
    name: "list_directory",
    arguments: { path: ROOT },
  });
  const listText = listResult.content.find((b) => b.type === "text")?.text ?? "";
  console.log("   Raw output:");
  for (const line of listText.split("\n")) {
    console.log(`     ${line}`);
  }
  const mdFiles = listText
    .split("\n")
    .filter((l) => l.startsWith("[FILE] ") && l.endsWith(".md"))
    .map((l) => l.slice("[FILE] ".length));
  console.log(`\n   → ${mdFiles.length} .md file(s) found: ${mdFiles.join(", ")}\n`);

  // ── 5. read_file (first .md) ─────────────────────────────────────────────────
  if (mdFiles.length > 0) {
    const target = path.join(ROOT, mdFiles[0]);
    console.log(`5. Calling read_file("${target}") …`);
    const readResult = await client.callTool({
      name: "read_file",
      arguments: { path: target },
    });
    const content = readResult.content.find((b) => b.type === "text")?.text ?? "";
    const preview = content.split("\n").slice(0, 6).join("\n");
    console.log("   First 6 lines:");
    for (const line of preview.split("\n")) {
      console.log(`     ${line}`);
    }
    console.log(`\n   → ${content.length} bytes total\n`);
  }

  // ── 6. Path traversal rejected ───────────────────────────────────────────────
  console.log("6. Testing path-traversal rejection …");
  const escapePath = path.resolve(ROOT, "../.env");
  console.log(`   Attempting to read: ${escapePath}`);
  try {
    const traversalResult = await client.callTool({
      name: "read_file",
      arguments: { path: escapePath },
    });
    // MCP errors may be returned in-band (isError: true) rather than thrown.
    if (traversalResult.isError) {
      const errText = traversalResult.content.find((b) => b.type === "text")?.text ?? "";
      console.log(`   ✓ Rejected (isError): ${errText}\n`);
    } else {
      console.log("   ✗ ERROR: traversal was NOT rejected — server allowed escape (unexpected)");
    }
  } catch (err) {
    console.log(`   ✓ Rejected (exception): ${err instanceof Error ? err.message : String(err)}\n`);
  }

  await client.close();
  console.log(SEP);
  console.log("Probe complete — MCP server is working correctly.");
  console.log(SEP);
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
