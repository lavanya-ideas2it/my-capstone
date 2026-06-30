# TeamWiki — Internal Knowledge Base

## Project Description

TeamWiki is an internal knowledge base / wiki application. Team members
write and edit articles in Markdown, organize them with tags and categories,
search the full corpus with full-text search, and browse the complete
revision history of any article. Access is governed by role-based
permissions (admins manage users and roles; editors write; viewers read).

The interesting engineering surface is **content management at scale**:
full-text search performance, revision tracking with diffing, and a
relational schema that stays clean as articles, tags, and revisions grow.

This is a CRUD-plus application — the "plus" being search indexing,
versioning, and authorization.

## Tech Stack

| Layer    | Technology                                   |
| -------- | -------------------------------------------- |
| Framework| Next.js 15 (App Router)                      |
| Language | TypeScript (strict mode)                     |
| Database | PostgreSQL                                   |
| ORM      | Prisma                                        |
| Styling  | Tailwind CSS                                  |
| Auth     | Session/JWT-based with role checks           |
| MCP      | Filesystem MCP (local doc import)            |
| CI/CD    | GitHub Actions (test → build → security → deploy) |

## Architecture Overview

```
├── Frontend (React + TypeScript, Next.js App Router)
│   ├── Article list with search bar
│   ├── Markdown editor with live preview
│   ├── Tag / category navigation sidebar
│   ├── Revision history viewer (with diffing)
│   └── Admin: user management + permissions
├── API (Next.js Route Handlers)
│   ├── CRUD  /api/articles
│   ├── GET   /api/search?q=...          (full-text)
│   ├── CRUD  /api/tags
│   ├── GET   /api/articles/:id/revisions
│   └── Auth endpoints + role checks
├── Database (PostgreSQL + Prisma)
│   ├── User, Article, Tag, Revision models
│   ├── Article ↔ Tag many-to-many
│   └── Full-text search index (tsvector + GIN)
├── MCP Integration
│   └── Filesystem MCP for local document import
└── CI/CD (GitHub Actions)
```

### Data model (intent)

- **User** — has a `role` (`ADMIN | EDITOR | VIEWER`). Owns/authors articles and revisions.
- **Article** — current state of a document (title, slug, body, author, timestamps). Many-to-many with **Tag**.
- **Tag** — label/category, joined to Article via an implicit or explicit join table.
- **Revision** — an immutable snapshot of an Article's content at a point in time. New edits append a Revision; the Article row holds the latest. Diffing is computed between revisions, not stored.

### Full-text search

Use PostgreSQL native FTS (`tsvector` column + GIN index), not application-side
filtering. The search column is derived from `title` and `body`. Prisma exposes
this via raw queries or `@@index` with the appropriate type; keep the indexed
column maintained by a trigger or generated column so it never drifts from content.

## Coding Conventions

### File & directory structure

```
app/                      # Next.js App Router
  (routes)/               # page routes and layouts
  api/                    # Route Handlers (route.ts files)
    articles/route.ts
    articles/[id]/route.ts
    articles/[id]/revisions/route.ts
    search/route.ts
    tags/route.ts
components/                # Reusable React components (PascalCase files)
lib/                       # Server-side helpers, auth, db client, search
  prisma.ts                # singleton Prisma client
  auth.ts                  # session + role-check helpers
  search.ts                # FTS query builders
prisma/
  schema.prisma            # single source of truth for the schema
  migrations/
types/                     # shared TypeScript types
__tests__/ or *.test.ts    # colocated or top-level tests
```

### Naming

- **Files**: React components in `PascalCase.tsx`; everything else (`lib/`, route files, utilities) in `kebab-case.ts` / Next.js conventions (`route.ts`, `page.tsx`, `layout.tsx`).
- **React components**: `PascalCase` (e.g. `MarkdownEditor`, `RevisionViewer`).
- **Functions & variables**: `camelCase`. Booleans read as predicates (`isPublished`, `canEdit`).
- **Types & interfaces**: `PascalCase`. Prefer `type` aliases for unions/shapes; `interface` for extensible object contracts.
- **Prisma models**: `PascalCase` singular (`User`, `Article`, `Revision`); fields `camelCase`; enums `SCREAMING_SNAKE_CASE` values.
- **DB tables/columns**: let Prisma map; use `@@map`/`@map` only if a specific casing is required.
- **API routes**: lowercase, plural resource nouns (`/api/articles`, `/api/tags`).
- **Constants**: `SCREAMING_SNAKE_CASE`.

### TypeScript

- `strict` mode on. No `any` — use `unknown` and narrow, or define the type.
- Validate all external input (request bodies, query params) at the API boundary with a schema validator (e.g. Zod) before it touches the DB.
- Derive types from Prisma (`Prisma.ArticleGetPayload<...>`) rather than hand-writing DB shapes.

### API conventions

- Route Handlers return `NextResponse.json(...)` with correct HTTP status codes (`200/201/204/400/401/403/404/409/500`).
- Every mutating route performs a role check first and returns `401` (unauthenticated) / `403` (unauthorized) before doing work.
- Errors return a consistent shape: `{ error: string }`. Never leak stack traces or raw DB errors to clients.
- Keep business logic in `lib/`, not inline in route files — route files orchestrate, helpers do the work.

### Database / Prisma

- `prisma/schema.prisma` is the single source of truth. All schema changes go through `prisma migrate`, never manual SQL against the DB (except FTS triggers/indexes managed in dedicated migrations).
- Use the singleton client from `lib/prisma.ts` (avoid exhausting connections in dev hot-reload).
- Revisions are append-only and immutable — never `UPDATE` a revision row.

### Styling

- Tailwind utility classes in markup. Extract repeated clusters into components, not `@apply` soup.
- Use the design tokens in `tailwind.config` for color/spacing; avoid arbitrary values unless necessary.

### Formatting

- Prettier + ESLint enforced. Run before committing; CI fails on lint errors.

## Testing Strategy

Aim for a layered approach, heaviest at the unit/integration boundary.

1. **Unit tests** (Vitest or Jest) — pure logic in `lib/`: search query building, diffing, permission checks, validators. Fast, no DB.
2. **API / integration tests** — exercise Route Handlers against a real test PostgreSQL (a disposable/containerized DB), covering:
   - CRUD happy paths for articles and tags
   - Full-text search returns expected ranked results
   - Revision creation on edit; revision list ordering
   - **Authorization matrix**: each role × each protected route returns the correct `200/403`.
3. **Component tests** (React Testing Library) — editor live preview, search bar behavior, revision viewer rendering.
4. **E2E (optional, smoke-level)** (Playwright) — create → edit → search → view-history flow as a logged-in editor.

Conventions:
- Tests live next to the code (`*.test.ts`) or under `__tests__/`.
- Each test seeds and tears down its own data; no shared mutable fixtures.
- Use a separate test database; never run tests against dev/prod data.
- CI runs the full suite on every PR (the `test` stage of the pipeline).

## CI/CD

GitHub Actions pipeline: **Test → Build → Security → Deploy**.

- **Test** — lint, type-check (`tsc --noEmit`), unit + integration tests against an ephemeral Postgres service.
- **Build** — `next build`; fails on type or build errors.
- **Security** — dependency audit and static analysis; block on high-severity findings.
- **Deploy** — on merge to `main` only, after all prior stages pass.

## Scope Boundaries — What This Project Does NOT Include

To keep the capstone focused, the following are explicitly **out of scope**:

- **Real-time collaborative editing** (no operational transforms / CRDTs / multi-cursor). One editor at a time; last-write-wins with revision history as the safety net.
- **WYSIWYG rich-text editing** — Markdown source + live preview only. No block editor.
- **Comments, reactions, or discussion threads** on articles.
- **Notifications** (email, in-app, or push) for edits, mentions, or approvals.
- **Approval/publishing workflows** — no draft→review→publish state machine beyond basic create/edit.
- **File/image upload & media storage** — articles are text/Markdown; no asset pipeline or object storage.
- **External SSO / OAuth providers** — auth is self-contained (local accounts + roles). No SAML/Okta/Google login.
- **Multi-tenancy / organizations / workspaces** — a single shared knowledge base, not per-team isolation.
- **Internationalization (i18n)** and localization.
- **Public sharing / anonymous access** — all access requires authentication.
- **Mobile native apps** — responsive web only.
- **Analytics, audit logs beyond revisions, or usage dashboards.**
- **AI-assisted authoring / semantic (vector) search** — search is keyword full-text (Postgres FTS), not embeddings.

The MCP Filesystem integration is limited to **importing local documents** into
the wiki; it is not a general-purpose file management feature.

---

## MCP Integration

### Overview

TeamWiki uses the **Filesystem MCP server** (`@modelcontextprotocol/server-filesystem`)
to enable bulk-import of local Markdown documents. The MCP server is the only
external boundary for the import feature — it provides sandboxed, read-only
access to the `./import-docs` directory.

### Configuration (`.mcp.json`)

The project root contains `.mcp.json` which configures the filesystem MCP
server for Claude Code (and other MCP-compatible clients):

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "node",
      "args": [
        "node_modules/@modelcontextprotocol/server-filesystem/dist/index.js",
        "./import-docs"
      ]
    }
  }
}
```

This gives Claude Code read access to `./import-docs/` so it can assist with
reviewing, editing, and importing documents. Access is **strictly confined** to
that directory — the server rejects any path outside it.

### How the Import Feature Uses MCP

The flow is:

```
Browser → GET /api/import/list          (lib/mcp.ts → list_directory via MCP)
        → lists .md files in import-docs

Browser → POST /api/import { files[] }  (lib/import.ts → reads + parses each file)
        → creates Article + Revision v1 per file
        → returns { created[], skipped[] }
```

Key files:

| File | Role |
|------|------|
| `lib/mcp.ts` | MCP client — spawns the filesystem server via stdio, calls `list_directory` and `read_file` tools |
| `lib/import.ts` | Parses front-matter, slugifies, calls `createArticle()`, handles duplicates |
| `app/api/import/list/route.ts` | `GET /api/import/list` — EDITOR+, returns available `.md` files via MCP |
| `app/api/import/route.ts` | `POST /api/import` — EDITOR+, runs the full import pipeline |
| `app/(app)/import/page.tsx` | Frontend import UI — file picker + report |

### Adding Import Documents

Drop `.md` files into `./import-docs/`. Optionally add YAML front-matter:

```markdown
---
title: My Document Title
tags: engineering, process
---

# Body starts here
```

If `title` is absent the filename is used. If `tags` names a tag that doesn't
exist yet, it is created automatically. Duplicate slugs are skipped and
reported in the `skipped[]` array (AC13.2).

### Safety

- The MCP server is scoped to `./import-docs` — path traversal is rejected at
  both the MCP server level and again in `lib/import.ts` (`resolveWithinRoot`).
- Parsed content passes through the same Zod schemas as the REST API.
- The import routes require EDITOR role minimum.

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `IMPORT_ROOT` | `./import-docs` | Absolute or relative path to the import directory |
