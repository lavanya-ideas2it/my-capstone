import type { RevisionSummary } from "@/types";

type Props = {
  revisions: RevisionSummary[];
  selectedFrom: number | null;
  selectedTo: number | null;
  onSelect: (version: number, slot: "from" | "to") => void;
};

export function RevisionList({
  revisions,
  selectedFrom,
  selectedTo,
  onSelect,
}: Props) {
  return (
    <div className="space-y-2">
      {revisions.map((rev) => {
        const date = new Date(rev.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const isFrom = selectedFrom === rev.version;
        const isTo = selectedTo === rev.version;

        return (
          <div
            key={rev.id}
            className={`flex items-start gap-3 rounded-lg border p-3 text-sm
              ${isFrom || isTo ? "border-brand-300 bg-brand-50" : "border-gray-200 bg-white"}`}
          >
            <div className="flex flex-col gap-1">
              <button
                onClick={() => onSelect(rev.version, "from")}
                className={`px-2 py-0.5 rounded text-xs font-medium
                  ${isFrom ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                From
              </button>
              <button
                onClick={() => onSelect(rev.version, "to")}
                className={`px-2 py-0.5 rounded text-xs font-medium
                  ${isTo ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                To
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-gray-900">
                  v{rev.version}
                </span>
                {rev.title && (
                  <span className="text-gray-700 truncate">{rev.title}</span>
                )}
              </div>
              <p className="text-gray-500 text-xs mt-0.5">
                {rev.editor.name} · {date}
              </p>
              {rev.changeSummary && (
                <p className="text-gray-600 text-xs mt-1 italic">
                  {rev.changeSummary}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
