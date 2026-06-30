# TeamWiki

Internal knowledge base for teams. Members write Markdown articles, organize them with tags, search the full corpus with full-text search, and browse the complete revision history of any article. Access is governed by three roles: **ADMIN**, **EDITOR**, and **VIEWER**.

## Quick Start

Get up and running in under 5 minutes.

**Prerequisites:** Node.js 20+, Docker

```bash
# 1. Clone and install
git clone <repo-url> teamwiki && cd teamwiki
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET to a random string of at least 32 characters:
#   openssl rand -hex 32

# 3. Start PostgreSQL
docker run -d \
  --name teamwiki-pg \
  -e POSTGRES_USER=teamwiki \
  -e POSTGRES_PASSWORD=teamwiki \
  -e POSTGRES_DB=teamwiki \
  -p 5433:5432 \
  postgres:16

# 4. Run migrations
npx prisma migrate dev

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first visit, go to `/register` to create the initial admin account — registration is open until the first user exists, then restricted to ADMINs.

## Architecture

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

**Auth flow:** `POST /api/auth/login` returns a short-lived JWT access token (stored in memory) and sets an httpOnly `refreshToken` cookie. The client calls `POST /api/auth/refresh` to silently rotate both before the access token expires.

**Full-text search:** PostgreSQL `tsvector` GENERATED column on `Article`, indexed with GIN. Queries use `websearch_to_tsquery` — no application-side filtering, ranked by `ts_rank`.

**Revision tracking:** Every save appends an immutable `Revision` row. `Article` holds a pointer to the current revision. Diffs are computed on read via LCS (never stored).

## Pages

| Route | Description | Min. role |
|-------|-------------|-----------|
| `/` | Article list — search bar + tag sidebar | VIEWER |
| `/articles/new` | Create article | EDITOR |
| `/articles/:id` | Read article (Markdown rendered) | VIEWER |
| `/articles/:id/edit` | Edit article | EDITOR |
| `/articles/:id/history` | Revision history + diff viewer | VIEWER |
| `/search` | Full-text search results | VIEWER |
| `/import` | Bulk import from `import-docs/` | EDITOR |
| `/admin/users` | User management | ADMIN |
| `/login` | Sign in | — |
| `/register` | Create account (ADMIN or bootstrap) | — |

## Project Structure

```
app/
  (app)/          # authenticated pages
  (auth)/         # login / register
  api/            # Route Handlers
components/       # PascalCase React components
lib/              # server helpers (auth, search, articles, revisions, import, mcp)
prisma/
  schema.prisma   # single source of truth
  migrations/
types/            # shared TypeScript types
tests/            # API integration tests
import-docs/      # drop .md files here for bulk import
docs/             # SECURITY-AUDIT.md, API.md, SPEC.md
.github/workflows/ci.yml
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL 16 |
| ORM | Prisma 6 |
| Styling | Tailwind CSS 3 |
| Auth | argon2id passwords, JWT (jose), httpOnly refresh cookie |
| Validation | Zod 4 |
| MCP | `@modelcontextprotocol/server-filesystem` (import pipeline) |
| Tests | Vitest 4 + `@vitest/coverage-v8` |
| CI/CD | GitHub Actions |

## Development Scripts

```bash
npm run dev           # start dev server (http://localhost:3000)
npm run build         # production build
npm run lint          # ESLint (flat config, typescript-eslint)
npm run typecheck     # tsc --noEmit

npm test              # run all tests once
npm run test:watch    # watch mode
npm run test:coverage # run with coverage report (threshold: 80%)

npm run db:migrate    # apply pending Prisma migrations
npm run db:reset      # drop + recreate + re-migrate (dev only)
npm run db:seed       # seed demo data
npm run db:studio     # open Prisma Studio at http://localhost:5555
```

## Testing

Tests are colocated or under `tests/`. The suite covers unit logic in `lib/` and API integration tests against a real PostgreSQL database.

```bash
# Requires a running Postgres with a teamwiki_test database.
# The global setup in tests/global-setup.ts creates it automatically.

npm test              # all tests
npm run test:coverage # with coverage — must hit 80% on statements and branches
```

Each test seeds and tears down its own data. Never run against dev or production data.

## Document Import (MCP)

Drop `.md` files into `import-docs/`. Optionally add YAML front-matter:

```markdown
---
title: My Document
tags: engineering, process
---

Body starts here.
```

Then open `/import` in the browser, select files, and click Import. The MCP filesystem server is scoped strictly to `./import-docs` — path traversal outside this directory is rejected at both the MCP and application layers.

## CI/CD

Three GitHub Actions jobs on every push to `main` and every pull request targeting `main`:

1. **test** — lint, type-check, `test:coverage` against an ephemeral Postgres 16 service
2. **build** — `next build` (requires `test` to pass first)
3. **security** — `npm audit --audit-level=high` (runs in parallel with `build`)

Deployment runs only on push to `main` after all jobs pass.

## Security

See [`docs/SECURITY-AUDIT.md`](docs/SECURITY-AUDIT.md) for the full audit report. Key controls:

- Passwords hashed with argon2id (time cost 3, memory 64 MiB)
- Refresh tokens are 48-byte random values, SHA-256 hashed before storage
- Rate limiting on login (20/15 min per IP) and register (10/hour per IP)
- Content-Security-Policy, HSTS, X-Content-Type-Options, and other headers on all routes
- All raw SQL uses `Prisma.sql` tagged templates — no string interpolation
- `JWT_SECRET` must be ≥ 32 characters; enforced at startup

## Environment Variables

See `.env.example` for the full reference.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Signing key — minimum 32 characters |
| `ACCESS_TOKEN_TTL` | No | Access token lifetime (default `15m`) |
| `IMPORT_ROOT` | No | Import directory path (default `./import-docs`) |
