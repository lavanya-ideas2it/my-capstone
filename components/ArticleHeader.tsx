import Link from "next/link";
import type { ArticleDetail } from "@/types";

type Props = {
  article: ArticleDetail;
  canEdit: boolean;
};

export function ArticleHeader({ article, canEdit }: Props) {
  const updated = new Date(article.updatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="mb-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold text-gray-900 leading-tight">
          {article.title}
        </h1>
        {canEdit && (
          <Link
            href={`/articles/${article.id}/edit`}
            className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-md
                       bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            Edit
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
        <span>by {article.author.name}</span>
        <span>·</span>
        <span>updated {updated}</span>
        {article.currentRevision && (
          <>
            <span>·</span>
            <span>v{article.currentRevision.version}</span>
          </>
        )}
      </div>

      {article.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {article.tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/?tag=${encodeURIComponent(tag.slug)}`}
              className="inline-block px-2.5 py-0.5 text-xs rounded-full bg-gray-100
                         text-gray-600 hover:bg-brand-50 hover:text-brand-700 transition-colors"
            >
              {tag.name}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
