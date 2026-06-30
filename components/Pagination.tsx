type Props = {
  page: number;
  total: number;
  limit?: number;
  onPage: (p: number) => void;
};

export function Pagination({ page, total, limit = 20, onPage }: Props) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-1 mt-6"
    >
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-600
                   disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
      >
        ‹ Prev
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
        .reduce<(number | "…")[]>((acc, p, i, arr) => {
          if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
          acc.push(p);
          return acc;
        }, [])
        .map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-2 text-gray-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              aria-current={p === page ? "page" : undefined}
              className={`px-3 py-1.5 text-sm rounded-md border
                ${p === page
                  ? "bg-brand-600 text-white border-brand-600 font-medium"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              {p}
            </button>
          )
        )}

      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-600
                   disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
      >
        Next ›
      </button>
    </nav>
  );
}
