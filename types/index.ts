export type Role = "ADMIN" | "EDITOR" | "VIEWER";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
};

export type TagSummary = {
  id: string;
  name: string;
  slug: string;
};

export type TagWithCount = TagSummary & {
  articleCount: number;
};

export type ArticleSummary = {
  id: string;
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; email: string };
  tags: TagSummary[];
};

export type RevisionSummary = {
  id: string;
  articleId: string;
  title: string;
  body: string;
  version: number;
  changeSummary: string | null;
  createdAt: string;
  editor: { id: string; name: string; email: string };
};

export type ArticleDetail = ArticleSummary & {
  body: string;
  authorId: string;
  currentRevisionId: string | null;
  currentRevision: RevisionSummary | null;
};

export type SearchHit = {
  id: string;
  slug: string;
  title: string;
  snippet: string;
  rank: number;
  updatedAt: string;
};

export type DiffLine = { op: "eq" | "add" | "del"; value: string };

export type DiffResult = {
  from: number;
  to: number;
  diff: {
    additions: number;
    deletions: number;
    lines: DiffLine[];
  };
};
