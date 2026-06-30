"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { DiffViewer } from "@/components/DiffViewer";
import { RevisionList } from "@/components/RevisionList";
import type { DiffResult, RevisionSummary } from "@/types";

type Props = { params: Promise<{ id: string }> };

export default function RevisionHistoryPage({ params }: Props) {
  const { id } = use(params);
  const { apiFetch } = useAuth();

  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [selectedFrom, setSelectedFrom] = useState<number | null>(null);
  const [selectedTo, setSelectedTo] = useState<number | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/api/articles/${id}/revisions`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load revisions");
        const { revisions: r } = (await res.json()) as {
          revisions: RevisionSummary[];
        };
        setRevisions(r);
        // Pre-select the most recent two for diffing if available.
        if (r.length >= 2) {
          setSelectedFrom(r[1].version);
          setSelectedTo(r[0].version);
        }
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Error")
      )
      .finally(() => setLoading(false));
  }, [apiFetch, id]);

  useEffect(() => {
    if (selectedFrom === null || selectedTo === null) {
      setDiff(null);
      return;
    }
    setDiffLoading(true);
    apiFetch(
      `/api/articles/${id}/diff?from=${selectedFrom}&to=${selectedTo}`
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to compute diff");
        const data = (await res.json()) as DiffResult;
        setDiff(data);
      })
      .catch(() => setDiff(null))
      .finally(() => setDiffLoading(false));
  }, [apiFetch, id, selectedFrom, selectedTo]);

  function handleSelect(version: number, slot: "from" | "to") {
    if (slot === "from") setSelectedFrom(version);
    else setSelectedTo(version);
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/articles/${id}`}
          className="text-sm text-brand-600 hover:text-brand-700"
        >
          ← Back to article
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Revision history</h1>
      </div>

      {loading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && <p className="text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Revisions
            </h2>
            {revisions.length === 0 ? (
              <p className="text-gray-500 text-sm">No revisions yet.</p>
            ) : (
              <RevisionList
                revisions={revisions}
                selectedFrom={selectedFrom}
                selectedTo={selectedTo}
                onSelect={handleSelect}
              />
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              {selectedFrom !== null && selectedTo !== null
                ? `Diff v${selectedFrom} → v${selectedTo}`
                : "Select two revisions to diff"}
            </h2>
            {diffLoading && (
              <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
            )}
            {!diffLoading && diff && (
              <DiffViewer
                diff={diff.diff.lines}
                additions={diff.diff.additions}
                deletions={diff.diff.deletions}
              />
            )}
            {!diffLoading && !diff && selectedFrom !== null && selectedTo !== null && (
              <p className="text-gray-500 text-sm">Failed to load diff.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
