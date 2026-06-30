// Article domain logic (kept out of route files per CLAUDE.md).
//
// Create and update both run inside a single interactive transaction so the
// Article row and its appended Revision are written atomically (AC6.1/6.2):
// a failure anywhere — e.g. a bad tag id — rolls the whole thing back.
import { Prisma } from "@prisma/client";
import { badRequest, notFound } from "./http";
import { prisma } from "./prisma";
import { slugify, uniqueSlug } from "./slug";
import type { CreateArticleInput, UpdateArticleInput } from "./validation";

// Shared "detail" shape returned by create/get/update.
const articleDetail = {
  include: {
    author: { select: { id: true, name: true, email: true } },
    tags: { select: { id: true, name: true, slug: true } },
    currentRevision: true,
  },
} satisfies Prisma.ArticleDefaultArgs;

export type ArticleDetail = Prisma.ArticleGetPayload<typeof articleDetail>;

/** Map a failed tag connect/set (P2025 etc.) to a clean 400. */
function mapTagError(err: unknown): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    ["P2025", "P2018", "P2016", "P2003"].includes(err.code)
  ) {
    throw badRequest("One or more tags do not exist");
  }
  throw err;
}

export async function createArticle(
  authorId: string,
  input: CreateArticleInput
): Promise<ArticleDetail> {
  const base = slugify(input.title);
  const taken = await prisma.article.findMany({
    where: { OR: [{ slug: base }, { slug: { startsWith: `${base}-` } }] },
    select: { slug: true },
  });
  const slug = uniqueSlug(base, taken.map((t) => t.slug));

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.article.create({
        data: {
          slug,
          title: input.title,
          body: input.body,
          authorId,
          tags: input.tagIds.length
            ? { connect: input.tagIds.map((id) => ({ id })) }
            : undefined,
        },
      });
      const revision = await tx.revision.create({
        data: {
          articleId: created.id,
          editorId: authorId,
          version: 1,
          title: input.title,
          body: input.body,
        },
      });
      return tx.article.update({
        where: { id: created.id },
        data: { currentRevisionId: revision.id },
        ...articleDetail,
      });
    });
  } catch (err) {
    mapTagError(err);
  }
}

export async function updateArticle(
  editorId: string,
  id: string,
  input: UpdateArticleInput
): Promise<ArticleDetail> {
  const current = await prisma.article.findUnique({ where: { id } });
  if (!current) throw notFound("Article not found");

  const title = input.title ?? current.title;
  const body = input.body ?? current.body;

  try {
    return await prisma.$transaction(async (tx) => {
      const { _max } = await tx.revision.aggregate({
        where: { articleId: id },
        _max: { version: true },
      });
      const nextVersion = (_max.version ?? 0) + 1;

      await tx.article.update({
        where: { id },
        data: {
          title,
          body,
          ...(input.tagIds
            ? { tags: { set: input.tagIds.map((t) => ({ id: t })) } }
            : {}),
        },
      });
      const revision = await tx.revision.create({
        data: {
          articleId: id,
          editorId,
          version: nextVersion,
          title,
          body,
          changeSummary: input.changeSummary ?? null,
        },
      });
      return tx.article.update({
        where: { id },
        data: { currentRevisionId: revision.id },
        ...articleDetail,
      });
    });
  } catch (err) {
    mapTagError(err);
  }
}

export async function getArticleById(id: string): Promise<ArticleDetail> {
  const article = await prisma.article.findUnique({
    where: { id },
    ...articleDetail,
  });
  if (!article) throw notFound("Article not found");
  return article;
}

export async function listArticles(opts: {
  tag?: string;
  page: number;
  limit: number;
}) {
  const where: Prisma.ArticleWhereInput = opts.tag
    ? {
        tags: {
          some: {
            OR: [{ slug: opts.tag }, { id: opts.tag }, { name: opts.tag }],
          },
        },
      }
    : {};

  const [items, total] = await prisma.$transaction([
    prisma.article.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: {
        id: true,
        slug: true,
        title: true,
        updatedAt: true,
        author: { select: { id: true, name: true } },
        tags: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.article.count({ where }),
  ]);

  return { items, total };
}

export async function deleteArticleById(id: string): Promise<void> {
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) throw notFound("Article not found");
  await prisma.article.delete({ where: { id } }); // cascades revisions (AC7.1)
}
