// Revision read + diff logic (SPEC US-8/US-9). Revisions are append-only;
// nothing here mutates them. Diffs are computed on read, never stored.
import { notFound } from "./http";
import { prisma } from "./prisma";
import { summarizeDiff } from "./diff";

async function assertArticleExists(articleId: string): Promise<void> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true },
  });
  if (!article) throw notFound("Article not found");
}

export async function listRevisions(
  articleId: string,
  page: number,
  limit: number
) {
  await assertArticleExists(articleId);
  return prisma.revision.findMany({
    where: { articleId },
    orderBy: { version: "desc" }, // newest-first (AC8.1)
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true,
      version: true,
      title: true,
      changeSummary: true,
      createdAt: true,
      editor: { select: { id: true, name: true } },
    },
  });
}

export async function getRevision(articleId: string, revId: string) {
  const revision = await prisma.revision.findFirst({
    where: { id: revId, articleId },
    include: { editor: { select: { id: true, name: true } } },
  });
  if (!revision) throw notFound("Revision not found");
  return revision;
}

export async function diffRevisions(
  articleId: string,
  fromVersion: number,
  toVersion: number
) {
  await assertArticleExists(articleId);
  const [from, to] = await Promise.all([
    prisma.revision.findUnique({
      where: { articleId_version: { articleId, version: fromVersion } },
    }),
    prisma.revision.findUnique({
      where: { articleId_version: { articleId, version: toVersion } },
    }),
  ]);
  if (!from || !to) throw notFound("Requested revision version not found");

  return {
    from: fromVersion,
    to: toVersion,
    diff: summarizeDiff(from.body, to.body),
  };
}
