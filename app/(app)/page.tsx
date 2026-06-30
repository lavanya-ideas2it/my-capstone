"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ArticleCard } from "@/components/ArticleCard";
import { Pagination } from "@/components/Pagination";
import type { ArticleSummary } from "@/types";

const LIMIT = 20;

export default function ArticleListPage() {
  const { apiFetch } = useAuth();
  const searchParams = useSearchParams();
  const tagSlug = searchParams.get("tag") ?? undefined;
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ArticleSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [tagSlug]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (tagSlug) params.set("tag", tagSlug);

    apiFetch(`/api/articles?${params}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load articles");
        const data = (await res.json()) as {
          items: ArticleSummary[];
          total: number;
        };
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Error loading articles")
      )
      .finally(() => setLoading(false));
  }, [apiFetch, page, tagSlug]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {tagSlug ? `Articles tagged "${tagSlug}"` : "All articles"}
      </h1>

      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-24 bg-white border border-gray-200 rounded-lg animate-pulse"
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="text-gray-500">
          No articles found.
        </p>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="space-y-3">
            {items.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
          <Pagination
            page={page}
            total={total}
            limit={LIMIT}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
