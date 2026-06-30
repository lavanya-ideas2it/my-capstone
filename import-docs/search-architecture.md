---
title: Full-Text Search Architecture
tags: search, postgresql, architecture
---

# Full-Text Search Architecture

TeamWiki uses PostgreSQL native full-text search (FTS) rather than an
external search engine. This document explains how it works and how to
maintain it.

## The `searchVector` Column

The `Article` table has a `tsvector` column generated automatically:

```sql
"searchVector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(body,  '')), 'B')
) STORED
```

Key points:
- **Generated column** — automatically updated on every INSERT/UPDATE, zero drift
- **`setweight`** — title tokens carry weight `A` (highest), body tokens `B`
- **`english`** dictionary — applies stemming (e.g. "running" → "run")

## The GIN Index

```sql
CREATE INDEX article_search_idx ON "Article" USING GIN ("searchVector");
```

GIN (Generalized Inverted Index) is optimal for `tsvector` — it maps each
lexeme to the rows that contain it, making `@@` operator lookups very fast.

## Query Flow (`lib/search.ts`)

```
user input → websearch_to_tsquery('english', ?) → @@ searchVector
```

`websearch_to_tsquery` parses natural-language input:
- `react hooks` → `'react' & 'hook'` (AND)
- `"react hooks"` → `'react' <-> 'hook'` (phrase)
- `react -hooks` → `'react' & !'hook'` (NOT)

Results are ordered by `ts_rank` (relevance score).

## Snippets

`ts_headline` generates highlighted excerpts from the body with `<mark>` tags
wrapping the matching terms. These are rendered in the search results page.

## Testing Search

The integration tests in `tests/api/search.test.ts` seed known articles and
assert that specific queries return the expected ranked results. Run:

```bash
npm test -- search
```
