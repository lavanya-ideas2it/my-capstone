"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { RoleGate } from "@/components/RoleGate";

type ImportReport = {
  created: Array<{ file: string; slug: string; title: string }>;
  skipped: Array<{ file: string; reason: string }>;
};

function ImportContent() {
  const { apiFetch } = useAuth();
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/import/list")
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not list import files.");
        const { files: f } = (await res.json()) as { files: string[] };
        setFiles(f);
      })
      .catch((e: unknown) =>
        setLoadError(e instanceof Error ? e.message : "Failed to load files.")
      )
      .finally(() => setLoadingFiles(false));
  }, [apiFetch]);

  function toggleFile(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === files.length) setSelected(new Set());
    else setSelected(new Set(files));
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setImportError(null);
    setReport(null);
    setImporting(true);
    try {
      const res = await apiFetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: Array.from(selected) }),
      });
      if (!res.ok) {
        const { error } = (await res.json()) as { error: string };
        setImportError(error ?? "Import failed.");
        return;
      }
      const data = (await res.json()) as ImportReport;
      setReport(data);
      // Deselect successfully imported files.
      setSelected((prev) => {
        const next = new Set(prev);
        for (const c of data.created) next.delete(c.file);
        return next;
      });
    } catch {
      setImportError("Network error. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Import documents</h1>
        <p className="text-sm text-gray-500 mt-1">
          Select Markdown files from the configured import directory
          to create wiki articles. Front-matter{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">title</code> and{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">tags</code> are
          read automatically.
        </p>
      </div>

      {/* File picker */}
      <div className="bg-white rounded-lg border border-gray-200 mb-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">
            Available files
            {!loadingFiles && (
              <span className="ml-1.5 text-gray-400">
                ({files.length} .md file{files.length !== 1 ? "s" : ""})
              </span>
            )}
          </span>
          {files.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-xs text-brand-600 hover:text-brand-700"
            >
              {selected.size === files.length ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>

        {loadingFiles && (
          <div className="p-4 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        )}

        {!loadingFiles && loadError && (
          <p className="p-4 text-sm text-red-600">{loadError}</p>
        )}

        {!loadingFiles && !loadError && files.length === 0 && (
          <p className="p-4 text-sm text-gray-500">
            No .md files found in{" "}
            <code className="bg-gray-100 px-1 rounded text-xs">
              {process.env.NEXT_PUBLIC_IMPORT_ROOT ?? "import-docs/"}
            </code>
            .
          </p>
        )}

        {!loadingFiles && !loadError && files.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {files.map((file) => (
              <li key={file}>
                <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(file)}
                    onChange={() => toggleFile(file)}
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm font-mono text-gray-700">{file}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {importError && (
        <p role="alert" className="text-sm text-red-600 mb-3">
          {importError}
        </p>
      )}

      <button
        onClick={handleImport}
        disabled={selected.size === 0 || importing}
        className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg
                   hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
      >
        {importing
          ? "Importing…"
          : `Import ${selected.size > 0 ? selected.size : ""} selected file${selected.size !== 1 ? "s" : ""}`}
      </button>

      {/* Import report */}
      {report && (
        <div className="mt-6 space-y-4">
          {report.created.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-green-700 mb-2">
                ✓ Created ({report.created.length})
              </h2>
              <ul className="space-y-1">
                {report.created.map((c) => (
                  <li key={c.file} className="text-sm text-gray-700">
                    <span className="font-mono text-gray-500">{c.file}</span>
                    {" → "}
                    <a
                      href={`/articles/${c.slug}`}
                      className="text-brand-600 hover:underline"
                    >
                      {c.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.skipped.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-amber-700 mb-2">
                ⚠ Skipped ({report.skipped.length})
              </h2>
              <ul className="space-y-1">
                {report.skipped.map((s) => (
                  <li key={s.file} className="text-sm text-gray-700">
                    <span className="font-mono text-gray-500">{s.file}</span>
                    {" — "}
                    <span className="text-amber-700">{s.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ImportPage() {
  return (
    <div>
      <RoleGate
        role="EDITOR"
        fallback={
          <p className="text-gray-500">
            Only editors and admins can import documents.
          </p>
        }
      >
        <ImportContent />
      </RoleGate>
    </div>
  );
}
