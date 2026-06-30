// Full-text search over articles (SPEC US-11 / §2.1).
//
// Uses the Postgres GIN/`tsvector` index via `websearch_to_tsquery`, ranks with
// `ts_rank` (title weighted 'A' above body 'B' in the generated column), and
// returns a highlighted snippet from `ts_headline`. The query string is bound
// as a parameter (never interpolated) — see SPEC §4 "SQL injection".
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type SearchHit = {
  id: string;
  slug: string;
  title: string;
  snippet: string;
  rank: number;
  updatedAt: Date;
};

export type SearchResult = { items: SearchHit[]; total: number };

export async function searchArticles(
  q: string,
  page: number,
  limit: number
): Promise<SearchResult> {
  const offset = (page - 1) * limit;
  const tsquery = Prisma.sql`websearch_to_tsquery('english', ${q})`;

  const rows = await prisma.$queryRaw<
    Array<Omit<SearchHit, "rank"> & { rank: number }>
  >(Prisma.sql`
    SELECT
      a."id",
      a."slug",
      a."title",
      ts_headline(
        'english', a."body", ${tsquery},
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MinWords=5, MaxWords=25, FragmentDelimiter=" … "'
      ) AS "snippet",
      ts_rank(a."searchVector", ${tsquery}) AS "rank",
      a."updatedAt" AS "updatedAt"
    FROM "Article" a
    WHERE a."searchVector" @@ ${tsquery}
    ORDER BY "rank" DESC, a."updatedAt" DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const countRows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT count(*)::int AS "count"
    FROM "Article" a
    WHERE a."searchVector" @@ ${tsquery}
  `);

  return {
    items: rows.map((r) => ({ ...r, rank: Number(r.rank) })),
    total: countRows[0]?.count ?? 0,
  };
}
