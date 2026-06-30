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

| Layer    | Technology                                           |
| -------- | ---------------------------------------------------- |
| Framework| Next.js 15 (App Router)                              |
| Language | TypeScript 6, strict mode                            |
| Database | PostgreSQL 16                                        |
| ORM      | Prisma 6                                             |
| Styling  | Tailwind CSS 3                                       |
| Auth     | argon2id passwords · JOSE JWTs · httpOnly refresh cookie |
| Validation | Zod 4 (every API boundary)                         |
| MCP      | Filesystem MCP (`@modelcontextprotocol/server-filesystem`) |
| Testing  | Vitest 4 + `@vitest/coverage-v8` (80% threshold)    |
| Lint     | ESLint 9 flat config + `typescript-eslint`           |
| CI/CD    | GitHub Actions (test → build → security)             |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                │
│  React (Next.js App Router) + Tailwind CSS              │
│  AuthProvider (JWT in memory) + httpOnly refresh cookie │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────────┐
│  Next.js Route Handlers  (app/api/**)                   │
│  handleRoute → requireRole → lib helpers → Prisma       │
│  Zod validation at every API boundary                   │
└────────────────────┬────────────────────────────────────┘
                     │ Prisma ORM
┌────────────────────▼────────────────────────────────────┐
│  PostgreSQL                                             │
│  User · Article · Revision · Tag · Session              │
│  tsvector GENERATED column + GIN index (FTS)            │
└─────────────────────────────────────────────────────────┘
         ▲
         │ stdio (MCP)
┌────────┴────────────────┐
│ Filesystem MCP server   │
│ scoped to ./import-docs │
└─────────────────────────┘
```

### Implemented API surface

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| GET | `/api/auth/bootstrap` | public | Is first-admin window open? |
| POST | `/api/auth/register` | public/ADMIN | Create user account |
| POST | `/api/auth/login` | public | Issue access token + refresh cookie |
| GET | `/api/auth/me` | any | Current user from DB |
| POST | `/api/auth/refresh` | cookie | Rotate refresh token |
| POST | `/api/auth/logout` | any | Revoke session |
| GET | `/api/articles` | VIEWER | List articles (paginated, tag filter) |
| POST | `/api/articles` | EDITOR | Create article + v1 revision |
| GET | `/api/articles/:id` | VIEWER | Article + tags + current revision |
| PUT | `/api/articles/:id` | EDITOR | Update + append revision |
| DELETE | `/api/articles/:id` | ADMIN | Delete (cascades revisions) |
| GET | `/api/articles/:id/revisions` | VIEWER | Revision history (newest first) |
| GET | `/api/articles/:id/revisions/:revId` | VIEWER | Single revision snapshot |
| GET | `/api/articles/:id/diff?from=&to=` | VIEWER | Computed line diff (not stored) |
| GET | `/api/search?q=` | VIEWER | PostgreSQL FTS, ranked + highlighted |
| GET | `/api/tags` | VIEWER | All tags with article counts |
| POST | `/api/tags` | EDITOR | Create tag |
| PUT | `/api/tags/:id` | EDITOR | Rename tag |
| DELETE | `/api/tags/:id` | ADMIN | Delete tag |
| GET | `/api/import/list` | EDITOR | List importable `.md` files (MCP) |
| POST | `/api/import` | EDITOR | Bulk import from `import-docs/` |
| GET | `/api/admin/users` | ADMIN | List all users |
| PATCH | `/api/admin/users/:id` | ADMIN | Update role / name |
| DELETE | `/api/admin/users/:id` | ADMIN | Delete user |

### Data model

```
User
  id, email (unique), name, passwordHash, role (ADMIN|EDITOR|VIEWER)
  → articles (authored), revisions (edited), sessions

Article
  id, slug (unique), title, body, authorId, currentRevisionId
  searchVector  Unsupported("tsvector")  — GENERATED ALWAYS from title+body
  → author (User), revisions (Revision[]), tags (Tag[]), currentRevision (Revision)

Revision  [append-only, never UPDATE]
  id, articleId, title, body, editorId, version (unique per article), changeSummary?
  → article (Article), editor (User)

Tag
  id, name (unique), slug (unique)
  ↔ articles (many-to-many)

Session
  id, userId, refreshTokenHash (unique), userAgent?, ip?
  expiresAt, revokedAt?
```

### Full-text search

Postgres native FTS. `Article.searchVector` is a `GENERATED ALWAYS AS` tsvector
column (defined in raw SQL in the `add_search_vector` migration). Prisma tracks it as
`Unsupported("tsvector")`; `@@index([searchVector], type: Gin)` creates the GIN index.
Queries use `websearch_to_tsquery` (parameterized — no injection risk) with `ts_rank`
ordering and `ts_headline` for snippet extraction. `sanitizeSnippet()` strips all HTML
except bare `<mark>` tags before returning snippets to the client.

### Authentication flow

1. **Login**: `POST /api/auth/login` → argon2id verify → create Session row → return
   short-lived JWT (default 15 min) in body + long-lived refresh token in `httpOnly` cookie.
2. **Request auth**: `Authorization: Bearer <jwt>` header → `requireRole()` / `requireUser()`
   in `lib/auth.ts` verifies the JOSE JWT and extracts `{ id, email, role }`.
3. **Token refresh**: `POST /api/auth/refresh` reads the cookie, verifies the SHA-256
   hash matches a non-expired, non-revoked Session, rotates the refresh token atomically.
4. **Logout**: `POST /api/auth/logout` sets `Session.revokedAt` and clears the cookie.
5. **Bootstrap**: First `POST /api/auth/register` (when `User.count() === 0`) is open to
   anyone and creates an ADMIN account. Subsequent registrations require ADMIN auth.

### Security controls

| Control | Implementation |
|---------|---------------|
| Password hashing | argon2id (time 3, mem 64 MiB) via `argon2` package |
| JWT signing | JOSE `HS256`, secret min 32 chars enforced at startup |
| Refresh token | 48-byte `randomBytes`, SHA-256 hashed in DB, rotated on every use |
| Cookie flags | `httpOnly`, `sameSite: strict`, `secure` in production |
| Rate limiting | Sliding-window in-process `Map`; 20/IP/15 min (login), 10/IP/hour (register) |
| Input validation | Zod at every API boundary, strict schemas (unknown fields rejected) |
| Role enforcement | `requireRole(req, Role.X)` first line of every protected handler |
| Open redirect | `?from=` validated: must start with `/` and not `//` |
| CSP | `default-src 'self'`; `frame-ancestors 'self'`; `poweredByHeader: false` |
| Error leakage | `handleRoute` returns generic 500; raw DB errors logged server-side only |
| SQL injection | All raw queries use `Prisma.sql` template tags |
| XSS (rendering) | `react-markdown` + `rehype-sanitize` allowlist |
| Path traversal | `resolveWithinRoot()` in `lib/import.ts`; MCP scoped to `./import-docs` |

## Coding Conventions

### File & directory structure

```
app/
  (app)/                    # authenticated pages (layout enforces auth)
    page.tsx                # article list
    articles/[id]/page.tsx  # article view
    articles/[id]/edit/page.tsx
    articles/[id]/history/page.tsx
    articles/new/page.tsx
    search/page.tsx
    import/page.tsx
    admin/users/page.tsx
  (auth)/                   # unauthenticated pages
    login/page.tsx
    register/page.tsx
  api/                      # Route Handlers
    articles/route.ts
    articles/[id]/route.ts
    articles/[id]/revisions/route.ts
    articles/[id]/revisions/[revId]/route.ts
    articles/[id]/diff/route.ts
    search/route.ts
    tags/route.ts
    tags/[id]/route.ts
    auth/{bootstrap,login,register,me,refresh,logout}/route.ts
    import/route.ts
    import/list/route.ts
    admin/users/route.ts
    admin/users/[id]/route.ts

components/                 # PascalCase React components
  AuthProvider.tsx          # JWT state + setCredentials
  MarkdownEditor.tsx        # CodeMirror editor with live preview
  MarkdownRenderer.tsx      # react-markdown + rehype-sanitize
  DiffViewer.tsx            # line-level add/remove/equal display
  RevisionList.tsx          # paginated revision history
  TagNav.tsx                # sidebar tag browser
  TagPicker.tsx             # multi-select tag input
  SearchBar.tsx             # debounced search input
  ArticleCard.tsx           # list item
  RoleGate.tsx              # renders children only for allowed roles
  SaveBar.tsx               # sticky bottom save/cancel bar
  Pagination.tsx            # page controls

lib/                        # server-side helpers
  prisma.ts                 # singleton Prisma client
  auth.ts                   # requireRole, requireUser, JWT helpers, argon2id
  articles.ts               # createArticle, updateArticle, listArticles, getArticleById, deleteArticleById
  revisions.ts              # listRevisions, getRevision, diffRevisions
  search.ts                 # searchArticles, sanitizeSnippet
  diff.ts                   # LCS-based line diff (diffLines)
  import.ts                 # importFiles, resolveWithinRoot, front-matter parser
  mcp.ts                    # MCP client (listImportFiles, readImportFile)
  validation.ts             # all Zod schemas
  http.ts                   # handleRoute, readJson, json, HttpError helpers
  ratelimit.ts              # sliding-window checkRateLimit, clientIp
  slug.ts                   # slugify

prisma/
  schema.prisma             # single source of truth
  migrations/               # including add_search_vector (raw SQL for tsvector)
  seed.ts                   # dev seed data

types/
  index.ts                  # shared TypeScript types (derived from Prisma payloads)

tests/
  helpers.ts                # createUser, createSession, authedReq, resetDb
  global-setup.ts           # create teamwiki_test DB if missing
  setup-env.ts              # TEST_DATABASE_URL env
  api/                      # integration tests per route group

import-docs/                # drop .md files here for bulk import
docs/
  SECURITY-AUDIT.md         # audit findings + fixes
  API.md                    # full endpoint reference
.github/workflows/ci.yml
.claude/commands/           # slash commands: deploy-check, security-scan, add-feature
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
- Validate all external input (request bodies, query params) at the API boundary with Zod before it touches the DB.
- Derive types from Prisma (`Prisma.ArticleGetPayload<...>`) rather than hand-writing DB shapes.

### API conventions

- Route Handlers wrap every handler in `handleRoute(async () => { ... })` from `lib/http.ts`.
  This catches `HttpError` instances (returns their status + `{ error }` shape) and all other
  errors (returns generic 500). Stack traces never reach the client.
- `requireRole(req, Role.X)` / `requireUser(req)` are always the first call inside `handleRoute`.
  They throw `HttpError(401)` / `HttpError(403)` before any business logic runs.
- Request bodies: `readJson(req)` parses JSON; pass the result to `.parse()` on a Zod schema.
  Query params: `parseQuery(schema, req.nextUrl.searchParams)`.
- Errors return `{ error: string }`. Never interpolate raw DB error messages.
- HTTP semantics: `200` (read/update), `201` (create), `204` (delete, no body), `400` (bad input),
  `401` (unauthenticated), `403` (unauthorized), `404` (not found), `409` (conflict), `429` (rate limit), `500` (unexpected).
- Business logic lives in `lib/`; route files only call helpers and return responses.

### Database / Prisma

- `prisma/schema.prisma` is the single source of truth. All schema changes go through
  `prisma migrate dev`, never manual SQL (except FTS column / GIN index in dedicated migrations).
- Use the singleton client from `lib/prisma.ts`.
- `Revision` rows are append-only and immutable — never `UPDATE` a revision row.
- The FTS `searchVector` column is `GENERATED ALWAYS AS` (Postgres-maintained); it never drifts
  from article content. Prisma exposes it as `Unsupported("tsvector")` — do not write to it.

### Styling

- Tailwind utility classes in markup. Extract repeated clusters into components, not `@apply` soup.
- Custom color token `brand` is defined in `tailwind.config`; use `brand-600` etc., not arbitrary hex.

### ESLint

ESLint 9 flat config (`eslint.config.mjs`) with `typescript-eslint`. Lint script: `eslint .`
(not `next lint` — `eslint-config-next` has a broken transitive dependency on `es-abstract`).
Run `npm run lint` before committing; CI fails on lint errors.

## Testing Strategy

### Framework

Vitest 4 with `@vitest/coverage-v8`. Configuration in `vitest.config.ts`:
- `fileParallelism: false` — tests share a single Postgres instance; serial execution prevents conflicts.
- `globalSetup: ["tests/global-setup.ts"]` — creates `teamwiki_test` DB once before the suite.
- `setupFiles: ["tests/setup-env.ts"]` — sets `TEST_DATABASE_URL` before each file.
- Coverage thresholds: 80% statements, branches, functions, lines.

### Layer breakdown

1. **Unit tests** (`lib/*.test.ts`) — pure logic with no DB: `diff.ts`, `slug.ts`, `validation.ts`,
   `auth.ts` (JWT helpers), `http.ts` (handleRoute, readJson). Fast; no Prisma calls.

2. **API integration tests** (`tests/api/*.test.ts`) — exercise Route Handlers against real
   `teamwiki_test` PostgreSQL. Each `describe` block calls `resetDb()` in `beforeEach`.
   Use `createUser(role)`, `createSession(userId)`, and `authedReq(method, path, body, session)`
   from `tests/helpers.ts`.
   - Every protected endpoint: 401 anonymous, 403 wrong role, 200/201/204 correct role.
   - CRUD happy paths + 404 for missing IDs + 409 for conflicts.
   - At least 2 edge cases per endpoint.

3. **MCP integration** (`lib/mcp.test.ts`) — spawns the real MCP server subprocess. Requires
   `IMPORT_ROOT` to point to a real directory. Timeout 15 000 ms per test.

### Running tests

```bash
npm test                # run all tests once
npm run test:watch      # watch mode
npm run test:coverage   # run + generate coverage report
```

Test database: `teamwiki_test`. Connection from `TEST_DATABASE_URL` in `.env`.
Never run tests against the dev or production database.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`). Three jobs:

```
test ──────────────────────────────────────────────────
  runs-on: ubuntu-latest
  services: postgres:16 on port 5433 (teamwiki/teamwiki)
  steps: checkout → setup-node@20 (npm cache) → npm ci
         → npm run lint
         → npm run typecheck
         → npm run test:coverage

build (needs: test) ────────────────────────────────────
  runs-on: ubuntu-latest
  steps: checkout → setup-node → npm ci → npm run build

security (parallel with build) ─────────────────────────
  runs-on: ubuntu-latest
  steps: checkout → setup-node → npm ci
         → npm audit --audit-level=high
```

Deploy (not yet wired): merge to `main`, after all jobs pass.

## Slash Commands (`.claude/commands/`)

| Command | File | Purpose |
|---------|------|---------|
| `/deploy-check` | `deploy-check.md` | 10-gate pre-deployment checklist (lint → typecheck → tests → build → audit → env vars → migrations → security doc → secrets scan → git status) |
| `/security-scan` | `security-scan.md` | Full security audit across 10 dimensions; fixes findings and updates `docs/SECURITY-AUDIT.md` |
| `/add-feature` | `add-feature.md` | 10-step scaffold for a new resource: Prisma model → migration → Zod schemas → routes → types → components → page → tests |

## Scope Boundaries — What This Project Does NOT Include

- **Real-time collaborative editing** — one editor at a time; last-write-wins with revision history as the safety net.
- **WYSIWYG rich-text editing** — Markdown source + live preview only.
- **Comments, reactions, or discussion threads** on articles.
- **Notifications** (email, in-app, or push).
- **Approval/publishing workflows** — no draft→review→publish state machine.
- **File/image upload & media storage** — articles are text/Markdown only.
- **External SSO / OAuth providers** — auth is self-contained local accounts + roles.
- **Multi-tenancy / organizations / workspaces** — single shared knowledge base.
- **Internationalization (i18n)** and localization.
- **Public sharing / anonymous access** — all access requires authentication.
- **Mobile native apps** — responsive web only.
- **Analytics, audit logs beyond revisions, or usage dashboards.**
- **AI-assisted authoring / semantic (vector) search** — keyword FTS only (Postgres).

---

## MCP Integration

### Overview

TeamWiki uses the **Filesystem MCP server** (`@modelcontextprotocol/server-filesystem`)
to enable bulk-import of local Markdown documents. The MCP server is the only
external boundary for the import feature — it provides sandboxed, read-only
access to the `./import-docs` directory.

### Configuration (`.mcp.json`)

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

Access is strictly confined to `./import-docs/` — the server rejects any path outside it.

### Import flow

```
Browser → GET /api/import/list          (lib/mcp.ts → list_directory via MCP)
        → lists .md files in import-docs

Browser → POST /api/import { files[] }  (lib/import.ts → reads + parses each file)
        → creates Article + Revision v1 per file
        → returns { created[], skipped[] }
```

| File | Role |
|------|------|
| `lib/mcp.ts` | MCP client — spawns the filesystem server via stdio, calls `list_directory` and `read_file` |
| `lib/import.ts` | Parses YAML front-matter, slugifies, calls `createArticle()`, handles duplicates |
| `app/api/import/list/route.ts` | `GET /api/import/list` — EDITOR+, returns available `.md` files |
| `app/api/import/route.ts` | `POST /api/import` — EDITOR+, runs the full import pipeline |
| `app/(app)/import/page.tsx` | Frontend import UI — file picker + import report |

### Adding import documents

Drop `.md` files into `./import-docs/`. Optionally add YAML front-matter:

```markdown
---
title: My Document Title
tags: engineering, process
---

# Body starts here
```

If `title` is absent the filename is used. If `tags` names a tag that doesn't exist yet,
it is created automatically. Duplicate slugs are skipped and reported in the `skipped[]` array.

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | — | Prisma connection string (required) |
| `TEST_DATABASE_URL` | — | Test database (required for `npm test`) |
| `JWT_SECRET` | — | Min 32 chars; enforced at startup by `secretKey()` in `lib/auth.ts` |
| `ACCESS_TOKEN_TTL` | `15m` | JWT expiry (JOSE duration string) |
| `IMPORT_ROOT` | `./import-docs` | Absolute or relative path to the import directory |
