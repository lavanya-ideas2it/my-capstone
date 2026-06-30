"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "./AuthProvider";
import type { TagWithCount } from "@/types";

function TagNavInner() {
  const { apiFetch } = useAuth();
  const searchParams = useSearchParams();
  const activeTag = searchParams.get("tag") ?? null;

  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/tags")
      .then((r) => r.json())
      .then(({ tags: t }) => setTags(t as TagWithCount[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiFetch]);

  if (loading) {
    return (
      <div className="space-y-1">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <nav aria-label="Browse by tag">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Tags
      </h2>
      <ul className="space-y-0.5">
        <li>
          <Link
            href="/"
            className={`flex items-center justify-between px-2 py-1.5 rounded-md text-sm
              ${!activeTag ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-600 hover:bg-gray-100"}`}
          >
            All articles
          </Link>
        </li>
        {tags.map((tag) => (
          <li key={tag.id}>
            <Link
              href={`/?tag=${encodeURIComponent(tag.slug)}`}
              className={`flex items-center justify-between px-2 py-1.5 rounded-md text-sm
                ${activeTag === tag.slug ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-600 hover:bg-gray-100"}`}
            >
              <span>{tag.name}</span>
              <span className="text-xs text-gray-400">
                {tag.articleCount}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function TagNav() {
  return (
    <Suspense>
      <TagNavInner />
    </Suspense>
  );
}
