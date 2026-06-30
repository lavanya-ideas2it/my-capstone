"use client";

import { use, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ArticleHeader } from "@/components/ArticleHeader";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { RevisionLink } from "@/components/RevisionLink";
import type { ArticleDetail } from "@/types";

type Props = { params: Promise<{ id: string }> };

export default function ArticleViewPage({ params }: Props) {
  const { id } = use(params);
  const { user, apiFetch } = useAuth();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/articles/${id}`)
      .then(async (res) => {
        if (res.status === 404) throw new Error("Article not found");
        if (!res.ok) throw new Error("Failed to load article");
        const { article: a } = (await res.json()) as { article: ArticleDetail };
        setArticle(a);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Error loading article")
      )
      .finally(() => setLoading(false));
  }, [apiFetch, id]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-100 rounded w-1/3" />
        <div className="h-64 bg-gray-100 rounded mt-6" />
      </div>
    );
  }

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  if (!article) return null;

  const canEdit =
    !!user && (user.role === "EDITOR" || user.role === "ADMIN");

  return (
    <div>
      <ArticleHeader article={article} canEdit={canEdit} />
      <MarkdownRenderer source={article.body} />
      <div className="mt-8 pt-4 border-t border-gray-200">
        <RevisionLink articleId={article.id} />
      </div>
    </div>
  );
}
