import Link from "next/link";

type Props = { articleId: string };

export function RevisionLink({ articleId }: Props) {
  return (
    <Link
      href={`/articles/${articleId}/history`}
      className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
      View history
    </Link>
  );
}
