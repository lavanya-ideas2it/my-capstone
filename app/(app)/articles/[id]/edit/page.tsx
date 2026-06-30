"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ChangeSummaryInput } from "@/components/ChangeSummaryInput";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { SaveBar } from "@/components/SaveBar";
import { TagPicker } from "@/components/TagPicker";
import type { ArticleDetail, TagSummary } from "@/types";

type Props = { params: Promise<{ id: string }> };

export default function EditArticlePage({ params }: Props) {
  const { id } = use(params);
  const { apiFetch } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [changeSummary, setChangeSummary] = useState("");
  const [allTags, setAllTags] = useState<TagSummary[]>([]);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch(`/api/articles/${id}`).then((r) => r.json()),
      apiFetch("/api/tags").then((r) => r.json()),
    ])
      .then(([articleData, tagData]) => {
        const a = (articleData as { article: ArticleDetail }).article;
        setTitle(a.title);
        setBody(a.body);
        setTagIds(a.tags.map((t) => t.id));
        setAllTags((tagData as { tags: TagSummary[] }).tags);
      })
      .catch(() => setLoadError("Failed to load article."))
      .finally(() => setLoading(false));
  }, [apiFetch, id]);

  async function handleSave() {
    if (!title.trim()) {
      setSaveError("Title is required.");
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const res = await apiFetch(`/api/articles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body,
          tagIds,
          changeSummary: changeSummary.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const { error: msg } = (await res.json()) as { error: string };
        setSaveError(msg ?? "Failed to save.");
        return;
      }
      const { article } = (await res.json()) as { article: ArticleDetail };
      router.push(`/articles/${article.id}`);
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/2" />
        <div className="h-80 bg-gray-100 rounded" />
      </div>
    );
  }

  if (loadError) return <p className="text-red-600">{loadError}</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Edit article</h1>

      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-lg font-semibold
                     focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>

      <div>
        <div className="flex items-center gap-4 mb-2">
          <span className="text-sm font-medium text-gray-700">Content</span>
          <div className="flex rounded-md border border-gray-300 overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setPreview(false)}
              className={`px-3 py-1 ${!preview ? "bg-gray-100 font-medium" : "hover:bg-gray-50"}`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setPreview(true)}
              className={`px-3 py-1 border-l border-gray-300 ${preview ? "bg-gray-100 font-medium" : "hover:bg-gray-50"}`}
            >
              Preview
            </button>
          </div>
        </div>

        {preview ? (
          <div className="min-h-[320px] p-4 border border-gray-200 rounded-lg bg-white">
            {body ? (
              <MarkdownRenderer source={body} />
            ) : (
              <p className="text-gray-400 italic">Nothing to preview.</p>
            )}
          </div>
        ) : (
          <MarkdownEditor value={body} onChange={setBody} />
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Tags</p>
        <TagPicker all={allTags} selected={tagIds} onChange={setTagIds} />
      </div>

      <ChangeSummaryInput value={changeSummary} onChange={setChangeSummary} />

      <SaveBar
        mode="edit"
        saving={saving}
        onSave={handleSave}
        onCancel={() => router.push(`/articles/${id}`)}
        error={saveError}
      />
    </div>
  );
}
