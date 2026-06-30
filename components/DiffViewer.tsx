import type { DiffLine } from "@/types";

type Props = {
  diff: DiffLine[];
  additions: number;
  deletions: number;
};

const lineClass: Record<DiffLine["op"], string> = {
  eq: "bg-white text-gray-700",
  add: "bg-green-50 text-green-800",
  del: "bg-red-50 text-red-800",
};

const linePrefix: Record<DiffLine["op"], string> = {
  eq: " ",
  add: "+",
  del: "-",
};

export function DiffViewer({ diff, additions, deletions }: Props) {
  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-sm font-medium">
        <span className="text-green-700">+{additions} additions</span>
        <span className="text-red-700">−{deletions} deletions</span>
      </div>

      <div className="rounded-lg border border-gray-200 overflow-auto font-mono text-sm">
        {diff.length === 0 ? (
          <p className="p-4 text-gray-500">No changes between these revisions.</p>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {diff.map((line, i) => (
                <tr key={i} className={lineClass[line.op]}>
                  <td className="select-none pl-3 pr-2 py-0.5 text-xs text-gray-400 w-5 border-r border-gray-200">
                    {linePrefix[line.op]}
                  </td>
                  <td className="pl-3 pr-4 py-0.5 whitespace-pre-wrap break-all">
                    {line.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
