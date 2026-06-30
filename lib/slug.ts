// Slug helpers. `slugify` is the pure transform; `uniqueSlug` de-duplicates
// against existing slugs by appending a numeric suffix (AC4.3 — creation never
// fails on a title collision).

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Given a desired base slug and the set of slugs already taken, return a slug
 * that is not in the set: the base itself, or `base-2`, `base-3`, …
 */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const root = base || "untitled";
  if (!used.has(root)) return root;
  let n = 2;
  while (used.has(`${root}-${n}`)) n++;
  return `${root}-${n}`;
}
