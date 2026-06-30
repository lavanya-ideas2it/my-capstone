"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ChangeSummaryInput } from "@/components/ChangeSummaryInput";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { SaveBar } from "@/components/SaveBar";
import { TagPicker } from "@/components/TagPicker";
import type { ArticleDetail, TagSummary } from "@/types";

export default function NewArticlePage() {
  const { apiFetch } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<TagSummary[]>([]);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/tags")
      .then((r) => r.json())
      .then(({ tags }) => setAllTags(tags as TagSummary[]))
      .catch(() => {});
  }, [apiFetch]);

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await apiFetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body, tagIds }),
      });
      if (!res.ok) {
        const { error: msg } = (await res.json()) as { error: string };
        setError(msg ?? "Failed to create article.");
        return;
      }
      const { article } = (await res.json()) as { article: ArticleDetail };
      router.push(`/articles/${article.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">New article</h1>

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
          placeholder="Article title…"
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

      <ChangeSummaryInput value="" onChange={() => {}} />

      <SaveBar
        mode="create"
        saving={saving}
        onSave={handleSave}
        onCancel={() => router.back()}
        error={error}
      />
    </div>
  );
}
