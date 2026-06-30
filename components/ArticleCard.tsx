import Link from "next/link";
import type { ArticleSummary } from "@/types";

type Props = { article: ArticleSummary };

export function ArticleCard({ article }: Props) {
  const updated = new Date(article.updatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <article className="bg-white border border-gray-200 rounded-lg p-5 hover:border-brand-300 hover:shadow-sm transition-all">
      <Link href={`/articles/${article.id}`} className="block">
        <h2 className="text-lg font-semibold text-gray-900 hover:text-brand-600 mb-1">
          {article.title}
        </h2>
      </Link>

      {article.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {article.tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/?tag=${encodeURIComponent(tag.slug)}`}
              className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600
                         hover:bg-brand-50 hover:text-brand-700 transition-colors"
            >
              {tag.name}
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">
        by {article.author.name} · updated {updated}
      </p>
    </article>
  );
}
