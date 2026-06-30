// Local Markdown import (SPEC §3 / US-13). Reads files from the configured
// import root only — any path resolving outside the root is rejected (AC13.3).
// Each file becomes an Article + v1 Revision; duplicate slugs are skipped and
// reported (AC13.2). Title/tags come from YAML front-matter, else the filename.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createArticle } from "./articles";
import { badRequest } from "./http";
import { prisma } from "./prisma";
import { slugify } from "./slug";

export type ImportReport = {
  created: Array<{ file: string; slug: string; title: string }>;
  skipped: Array<{ file: string; reason: string }>;
};

type FrontMatter = { title?: string; tags?: string[] };

function parseDocument(raw: string): { meta: FrontMatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { meta: {}, body: raw };

  const meta: FrontMatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "title") meta.title = value;
    else if (key === "tags") {
      meta.tags = value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }
  return { meta, body: raw.slice(match[0].length) };
}

function importRoot(): string {
  return path.resolve(process.env.IMPORT_ROOT ?? "./import-docs");
}

/** Resolve a requested file under the root, rejecting traversal (AC13.3). */
function resolveWithinRoot(root: string, file: string): string {
  const resolved = path.resolve(root, file);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw badRequest(`Path escapes import root: ${file}`);
  }
  return resolved;
}

async function resolveTagIds(names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const tag = await prisma.tag.upsert({
      where: { name },
      create: { name, slug: slugify(name) },
      update: {},
    });
    ids.push(tag.id);
  }
  return ids;
}

export async function importFiles(
  authorId: string,
  files: string[]
): Promise<ImportReport> {
  const root = importRoot();
  const report: ImportReport = { created: [], skipped: [] };

  for (const file of files) {
    const resolved = resolveWithinRoot(root, file); // throws 400 on traversal

    let raw: string;
    try {
      raw = await readFile(resolved, "utf8");
    } catch {
      report.skipped.push({ file, reason: "file not found or unreadable" });
      continue;
    }

    const { meta, body } = parseDocument(raw);
    const title = meta.title?.trim() || path.basename(file).replace(/\.md$/i, "");
    const slug = slugify(title);

    const exists = await prisma.article.findUnique({ where: { slug } });
    if (exists) {
      report.skipped.push({ file, reason: "duplicate slug" });
      continue;
    }

    const tagIds = await resolveTagIds(meta.tags ?? []);
    const article = await createArticle(authorId, { title, body, tagIds });
    report.created.push({ file, slug: article.slug, title: article.title });
  }

  return report;
}
