// Line-based diff between two revision bodies, computed on read (SPEC US-9 —
// diffs are never stored). Classic LCS over lines, emitting equal / added /
// removed segments newest-relative-to-oldest.

export type DiffOp = "eq" | "add" | "del";
export type DiffLine = { op: DiffOp; value: string };

function splitLines(text: string): string[] {
  // Keep behaviour stable for empty input (one empty line vs none).
  if (text === "") return [];
  return text.replace(/\r\n/g, "\n").split("\n");
}

/**
 * Diff `from` -> `to`. Lines present only in `from` are `del`, lines present
 * only in `to` are `add`, common lines are `eq`.
 */
export function diffLines(from: string, to: string): DiffLine[] {
  const a = splitLines(from);
  const b = splitLines(to);
  const n = a.length;
  const m = b.length;

  // LCS length table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0)
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: "eq", value: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ op: "del", value: a[i] });
      i++;
    } else {
      out.push({ op: "add", value: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ op: "del", value: a[i++] });
  while (j < m) out.push({ op: "add", value: b[j++] });
  return out;
}

export type DiffSummary = {
  additions: number;
  deletions: number;
  lines: DiffLine[];
};

export function summarizeDiff(from: string, to: string): DiffSummary {
  const lines = diffLines(from, to);
  let additions = 0;
  let deletions = 0;
  for (const l of lines) {
    if (l.op === "add") additions++;
    else if (l.op === "del") deletions++;
  }
  return { additions, deletions, lines };
}
