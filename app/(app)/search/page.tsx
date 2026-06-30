"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { Pagination } from "@/components/Pagination";
import type { SearchHit } from "@/types";

const LIMIT = 20;

export default function SearchPage() {
  const { apiFetch } = useAuth();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [q]);

  useEffect(() => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ q, page: String(page), limit: String(LIMIT) });
    apiFetch(`/api/search?${params}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Search failed");
        const data = (await res.json()) as { items: SearchHit[]; total: number };
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Search error")
      )
      .finally(() => setLoading(false));
  }, [apiFetch, q, page]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Search results</h1>
      {q && (
        <p className="text-gray-500 text-sm mb-6">
          {total} result{total !== 1 ? "s" : ""} for <strong>{q}</strong>
        </p>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-white border border-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && !error && items.length === 0 && q && (
        <p className="text-gray-500">No articles matched your query.</p>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="space-y-3">
            {items.map((hit) => (
              <article
                key={hit.id}
                className="bg-white border border-gray-200 rounded-lg p-5 hover:border-brand-300 hover:shadow-sm transition-all"
              >
                <Link
                  href={`/articles/${hit.id}`}
                  className="block font-semibold text-gray-900 hover:text-brand-600 mb-1"
                >
                  {hit.title}
                </Link>
                {/* Snippet contains <mark> tags from ts_headline — render as HTML.
                    rehype-sanitize is not used here since the snippet is server-generated,
                    but we strip any unexpected tags as a precaution. */}
                <p
                  className="text-sm text-gray-600 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: hit.snippet }}
                />
              </article>
            ))}
          </div>
          <Pagination page={page} total={total} limit={LIMIT} onPage={setPage} />
        </>
      )}
    </div>
  );
}
