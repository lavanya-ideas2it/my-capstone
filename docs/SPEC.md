# TeamWiki — Formal Specification

> **Status:** Draft v2 · **Date:** 2026-06-29 · **Owner:** lavanya@ideas2it.com
> **Stack:** Next.js 15 (App Router) · TypeScript (strict) · Prisma · PostgreSQL · Tailwind CSS · custom JWT + DB-backed sessions · CodeMirror editor · Filesystem MCP

TeamWiki is an internal knowledge base: Markdown articles with PostgreSQL
full-text search, append-only revision history with diffing, and role-based
access control. This document is the authoritative specification; it derives
from the approved implementation plan and the project's `CLAUDE.md` conventions.

**Sections:** 1 Requirements · 2 Technical Design · 3 MCP Integration Plan ·
4 Security Considerations · 5 Testing Strategy · 6 Implementation Plan ·
7 Scope Boundaries · 8 Success Criteria · 9 Grading Rubric Cross-Reference.

---

## 1. Requirements

Roles: **ADMIN** (manage users + everything below), **EDITOR** (create/edit
articles & tags), **VIEWER** (read + search). Each story lists acceptance
criteria in Given/When/Then form.

### 1.1 Authentication & Accounts

**US-1 — Log in**
*As a user, I want to log in with email + password so I can access the wiki.*
- **AC1.1** Given valid credentials, when I submit login, then I receive an access token (in memory) and an httpOnly refresh cookie, and land on the article list.
- **AC1.2** Given invalid credentials, when I submit login, then I get a `401` with a generic error (no hint whether email or password was wrong).
- **AC1.3** Given I am logged in, when my access token expires, then it silently refreshes via the refresh cookie without forcing re-login.
- **AC1.4** Given repeated failed logins from one IP/account, when the threshold is exceeded, then further attempts are rate-limited with `429` (see §4).

**US-2 — Log out**
*As a user, I want to log out so my session can no longer be used.*
- **AC2.1** When I log out, then the server session row is revoked (`revokedAt` set) and the refresh cookie is cleared; subsequent refresh attempts return `401`.

**US-3 — Account provisioning**
*As an admin, I want to create accounts and assign roles.*
- **AC3.1** Given I am ADMIN, when I register a user with a role, then the account is created with a hashed password and that role.
- **AC3.2** Given I am not ADMIN, when I call register, then I get `403`.

### 1.2 Articles

**US-4 — Create article**
*As an editor, I want to create a Markdown article with tags.*
- **AC4.1** Given I am EDITOR/ADMIN, when I save a new article, then it is created with a unique slug derived from the title and an initial revision (version 1).
- **AC4.2** Given I am VIEWER, when I attempt to create, then I get `403`.
- **AC4.3** Given a title that collides on slug, when I save, then the slug is de-duplicated (suffix) — creation does not fail.

**US-5 — Read article**
*As a viewer, I want to read a rendered article.*
- **AC5.1** Given an article exists, when I open it, then its Markdown renders safely (no script execution) with its tags and last-updated metadata.
- **AC5.2** Given a body containing `<script>` or raw HTML, when rendered, then the dangerous content is sanitized/inert.

**US-6 — Edit article**
*As an editor, I want to edit an article and have the previous version preserved.*
- **AC6.1** Given I edit and save, then the article body updates **and** a new revision (version N+1) is appended; the article's `currentRevisionId` points to the latest.
- **AC6.2** Given the save transaction fails partway, then neither the article nor a revision is partially written (atomic rollback).
- **AC6.3** I may attach an optional change summary to the edit.

**US-7 — Delete article**
*As an admin, I want to delete an article.*
- **AC7.1** Given I am ADMIN, when I delete, then the article and its revisions are removed (cascade); editors/viewers get `403`.

### 1.3 Revisions & Diff

**US-8 — View history**
*As a viewer, I want to see an article's revision history.*
- **AC8.1** When I open history, then revisions are listed newest-first with version, editor, timestamp, and change summary.

**US-9 — Compare revisions**
*As a viewer, I want to diff two revisions.*
- **AC9.1** Given two versions, when I request a diff, then I see additions/deletions between them computed on read (diffs are not stored).

### 1.4 Tags / Navigation

**US-10 — Browse by tag**
*As a viewer, I want to filter articles by tag/category.*
- **AC10.1** When I select a tag, then the list shows only articles with that tag, paginated.
- **AC10.2** EDITORs can create/rename tags; only ADMIN can delete a tag.

### 1.5 Search

**US-11 — Full-text search**
*As a viewer, I want to search article content.*
- **AC11.1** Given a query, when I search, then matching articles return ranked by relevance (title weighted above body) with a highlighted snippet.
- **AC11.2** Search uses the Postgres GIN/`tsvector` index (verifiable via `EXPLAIN ANALYZE`), not in-app filtering.
- **AC11.3** Multi-word and quoted queries behave per `websearch_to_tsquery` semantics.

### 1.6 Admin

**US-12 — Manage users**
*As an admin, I want to list users and change roles.*
- **AC12.1** Given I am ADMIN, when I open user admin, then I can view all users and change a user's role or delete them.
- **AC12.2** Non-admins cannot see or reach the admin UI/routes (`403` + UI hidden via RoleGate).

### 1.7 Import (MCP)

**US-13 — Import local docs**
*As an editor, I want to bulk-import local Markdown files.*
- **AC13.1** Given `.md` files in the configured import root, when I import, then an article + initial revision is created per file (title/tags from front-matter or filename).
- **AC13.2** Duplicate slugs are skipped and reported; the response lists `created[]` and `skipped[]`.
- **AC13.3** Path-traversal (`..`) or paths outside the import root are rejected.

---

## 2. Technical Design

### 2.1 Data Model

```
                 ┌──────────────┐
                 │     User     │
                 │──────────────│
                 │ id (PK)      │
                 │ email  ⨯U     │
                 │ name         │
                 │ passwordHash │
                 │ role  (enum) │
                 │ timestamps   │
                 └──────┬───────┘
        author/editor   │ 1
            ┌───────────┼─────────────┬──────────────┐
          n │         n │           n │              │
   ┌────────┴───┐  ┌────┴──────┐  ┌───┴────────┐     │
   │  Article   │  │ Revision  │  │  Session   │     │
   │────────────│  │───────────│  │────────────│     │
   │ id (PK)    │  │ id (PK)   │  │ id (PK)    │     │
   │ slug  ⨯U    │  │ articleId │──┘ userId (FK)│◄────┘
   │ title      │◄─┤ (FK)      │   │ refreshTokenHash
   │ body(Text) │ 1│ title     │   │ userAgent/ip
   │ authorId FK│ n│ body(Text)│   │ expiresAt
   │ currentRev │··│ editorId  │   │ revokedAt?
   │  isionId? ─┼─▶│ version   │   │ createdAt
   │ searchVec  │  │ changeSum?│   └────────────┘
   │ timestamps │  │ createdAt │
   └─────┬──────┘  └───────────┘   @@unique([articleId, version])
       n │                          searchVector = tsvector (GIN)
         │ m-n  (implicit join _ArticleToTag)
       n │
   ┌─────┴──────┐
   │    Tag     │
   │────────────│
   │ id (PK)    │
   │ name  ⨯U   │
   │ slug  ⨯U   │
   └────────────┘

Legend: ⨯U = unique · FK = foreign key · ··▶ = nullable pointer to latest revision
```

**Enum:** `Role = ADMIN | EDITOR | VIEWER`

**Relationships**
- User 1—n Article (author) · User 1—n Revision (editor) · User 1—n Session
- Article 1—n Revision · Article → currentRevision (nullable 1—1 to latest) · Article n—m Tag
- All FKs to Article/User cascade-delete where a child cannot outlive its parent (Revision, Session).

**Full-text index** (raw migration after `prisma migrate`):
```sql
ALTER TABLE "Article" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(body,'')),  'B')
  ) STORED;
CREATE INDEX article_search_idx ON "Article" USING GIN ("searchVector");
```
Generated column → zero drift, no trigger to maintain. `Revision` is append-only and immutable (never `UPDATE`).

### 2.2 API Contracts

Next.js Route Handlers under `app/api/`. JSON only. Error shape `{ error: string }`.
Every protected handler gates auth first: `401` unauthenticated → `403` wrong role → then work.

**Auth**

| Method | Path | Role | Request | Success |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | ADMIN¹ | `{email,name,password,role?}` | `201 {user}` |
| POST | `/api/auth/login` | public | `{email,password}` | `200 {user, accessToken}` + refresh cookie |
| POST | `/api/auth/refresh` | cookie | — | `200 {accessToken}` |
| POST | `/api/auth/logout` | auth | — | `204` |
| GET | `/api/auth/me` | auth | — | `200 {user}` |

¹ Open only for the first-admin bootstrap.

**Articles**

| Method | Path | Role | Request | Success |
| --- | --- | --- | --- | --- |
| GET | `/api/articles` | VIEWER | `?tag=&page=&limit=` | `200 {items[], total, page}` |
| POST | `/api/articles` | EDITOR | `{title, body, tagIds[]}` | `201 {article}` (rev v1) |
| GET | `/api/articles/:id` | VIEWER | — | `200 {article, tags, currentRevision}` |
| PUT | `/api/articles/:id` | EDITOR | `{title?, body?, tagIds?, changeSummary?}` | `200 {article}` (appends rev) |
| DELETE | `/api/articles/:id` | ADMIN | — | `204` |
| GET | `/api/articles/:id/revisions` | VIEWER | `?page=` | `200 {revisions[]}` |
| GET | `/api/articles/:id/revisions/:revId` | VIEWER | — | `200 {revision}` |
| GET | `/api/articles/:id/diff` | VIEWER | `?from=<v>&to=<v>` | `200 {diff}` |

`PUT` runs in one `prisma.$transaction`: update Article + insert Revision(version+1) + set `currentRevisionId`.

**Search / Tags / Admin / Import**

| Method | Path | Role | Request | Success |
| --- | --- | --- | --- | --- |
| GET | `/api/search` | VIEWER | `?q=&page=&limit=` | `200 {items[], total}` ranked (`ts_rank`, `ts_headline`) |
| GET | `/api/tags` | VIEWER | — | `200 {tags[]}` (+counts) |
| POST | `/api/tags` | EDITOR | `{name}` | `201 {tag}` |
| PUT | `/api/tags/:id` | EDITOR | `{name}` | `200 {tag}` |
| DELETE | `/api/tags/:id` | ADMIN | — | `204` |
| GET | `/api/admin/users` | ADMIN | — | `200 {users[]}` |
| PATCH | `/api/admin/users/:id` | ADMIN | `{role?, name?}` | `200 {user}` |
| DELETE | `/api/admin/users/:id` | ADMIN | — | `204` |
| POST | `/api/import` | EDITOR | `{files[]}` | `201 {created[], skipped[]}` |

All bodies + query params validated with Zod at the boundary; unknown fields rejected.

### 2.3 Component Tree

```
app/
  layout.tsx                       → AppShell {children}              (AuthProvider, top bar)
  (auth)/login/page.tsx            → LoginForm
  (app)/
    layout.tsx                     → SidebarLayout {user}
                                       ├─ TagNav {tags, activeTag?}
                                       └─ SearchBar {initialQuery?, onSearch}
    page.tsx                       → ArticleListPage
                                       ├─ ArticleList {items, total, page}
                                       │    └─ ArticleCard {article}
                                       └─ Pagination {page, total, onPage}
    articles/[id]/page.tsx         → ArticleViewPage
                                       ├─ ArticleHeader {title, author, updatedAt, tags, canEdit}
                                       ├─ MarkdownRenderer {source}     (react-markdown + rehype-sanitize)
                                       └─ RevisionLink {articleId}
    articles/new/page.tsx          ┐
    articles/[id]/edit/page.tsx    ┴→ ArticleEditPage {article?, mode}
                                       ├─ MarkdownEditor {value, onChange}   (CodeMirror 6)
                                       ├─ MarkdownPreview {source}           (reuses MarkdownRenderer)
                                       ├─ TagPicker {selected, all, onChange}
                                       ├─ ChangeSummaryInput {value, onChange}   (edit only)
                                       └─ SaveBar {saving, onSave, onCancel}
    articles/[id]/history/page.tsx → RevisionHistoryPage {articleId}
                                       ├─ RevisionList {revisions, onSelect}
                                       └─ DiffViewer {from, to, diff}
    admin/users/page.tsx           → UserAdminPage          (ADMIN guard)
                                       ├─ UserTable {users, onRoleChange, onDelete}
                                       └─ RoleSelect {value, onChange}

Shared: AuthProvider (context: user + in-memory access token, cookie refresh),
        RoleGate {role, children} (conditional UI).
```

Server components fetch data; client components (`MarkdownEditor`, `SearchBar`, forms, `AuthProvider`) handle interactivity.

---

## 3. MCP Integration Plan

**Server:** the official **Filesystem MCP server**
(`@modelcontextprotocol/server-filesystem`), scoped to a single allowed import
directory (e.g. `./import-docs`).

**What it enables:** bulk-importing local Markdown/text docs into the wiki
without manual copy-paste — list a directory, read file contents, and create
Articles from them.

**Flow**
1. Filesystem MCP is configured with a locked root path; no access outside it.
2. An EDITOR triggers import (admin UI button → `POST /api/import` with selected files, or a one-off import script).
3. Server-side: list dir via MCP → read each file → parse front-matter (title/tags) if present, else derive title from filename → `slugify` → create Article + initial Revision (v1) in one transaction.
4. Response reports `created[]` and `skipped[]` (see `/api/import` in §2.2; behaviour in US-13).

**Safety**
- Import path confined to the MCP root; reject `..` traversal and any path resolving outside the root (AC13.3).
- Parsed content validated through the same Zod schemas as the API.
- Importer runs with EDITOR-level authorization.

**Scope:** MCP is **import-only** — not general file management (see §7).

---

## 4. Security Considerations

- **Passwords** — argon2id hashing; never stored or logged in plaintext; enforce minimum length + basic strength.
- **Tokens** — short-lived JWT access token (~15 min) held **in memory** (not localStorage); long-lived refresh token in an **httpOnly, Secure, SameSite=Strict** cookie; the refresh token is **hashed** in the `Session` table; rotated on each refresh; logout/admin action sets `revokedAt`.
- **Authorization** — central `requireUser()` / `requireRole(role)` helpers in `lib/auth.ts`; every protected handler gates first (`401` then `403`) before any work. The client-sent role is never trusted; role is read from the verified token/DB.
- **Input validation** — Zod schema at every API boundary for body + query params; unknown fields rejected; validation happens before any DB access.
- **SQL injection** — Prisma parameterizes all queries; raw FTS queries use parameter binding (`Prisma.sql` / tagged-template `$queryRaw`), never string interpolation of user input.
- **XSS** — Markdown rendered via `react-markdown` + **rehype-sanitize**; no `dangerouslySetInnerHTML` of raw HTML (AC5.2).
- **CORS / CSRF** — API is same-origin (Next.js); no wildcard CORS. If an external client is ever needed, allowlist explicit origins via middleware. CSRF is mitigated by the `SameSite=Strict` cookie plus requiring the access token in an `Authorization` header for mutations.
- **Rate limiting** — throttle `/api/auth/login` (per IP + per account) and `/api/search`; exceeding the threshold returns `429` (AC1.4). Implemented in middleware or a lightweight limiter (in-memory in dev, Redis-backed in prod).
- **Secrets** — JWT signing key, DB URL, and MCP root come from environment variables; never committed. `.env.example` documents required keys.
- **Error hygiene** — consistent `{ error }` shape; stack traces and raw Prisma/DB errors never leak to clients.
- **Security headers** — CSP, `X-Content-Type-Options`, `Referrer-Policy`, etc., set via `next.config`/middleware.
- **MCP path safety** — import confined to the configured root; traversal rejected (§3).

**Security audit (automated, in CI — see §6 Phase 9):**
- **Dependency audit** — `npm audit --audit-level=high` (or `pnpm audit`); the build fails on high/critical advisories.
- **Static analysis (SAST)** — a code scanner (e.g. CodeQL or Semgrep) runs on every PR; high-severity findings block merge.
- **Secret scanning** — detect committed secrets (e.g. gitleaks) in the pipeline.

---

## 5. Testing Strategy

Layered, heaviest at the unit/integration boundary. Tests colocated as
`*.test.ts(x)` or under `__tests__/`. Each test seeds and tears down its own
data against a **separate, ephemeral test database** — never dev/prod data.

| Layer | Tool | What is tested |
| --- | --- | --- |
| **Unit** | Vitest | `lib/` pure logic: slugify, diff computation, permission checks, Zod validators, password hashing, JWT sign/verify, FTS query builder. No DB. |
| **Integration (API)** | Vitest + ephemeral Postgres | Each Route Handler against a real test DB: CRUD happy paths; revision appended + version increments on PUT; transactional PUT rolls back on failure; search returns ranked results for a known seed; **authorization matrix** = every protected route × {anon, VIEWER, EDITOR, ADMIN} → correct `200/401/403`. |
| **Component** | React Testing Library | Editor↔preview sync, SearchBar debounce, DiffViewer rendering, RoleGate hides admin UI for non-admins. |
| **E2E (smoke)** | Playwright | Login → create → edit → search → view-history as an EDITOR. |

**Coverage gate:** the suite runs with coverage (Vitest `--coverage` / c8). CI
**fails the build below 80%** line **and** branch coverage. The threshold is
declared in the test config (e.g. `coverage.thresholds` in `vitest.config.ts`),
so the gate is enforced, not aspirational.

CI runs the full suite on every PR (the Test stage of §6 Phase 9).

---

## 6. Implementation Plan

| Phase | Work | Est. |
| --- | --- | --- |
| **0. Scaffold** | create-next-app (TS, App Router, Tailwind), ESLint/Prettier, env, Prisma init, Postgres (Docker), `lib/prisma.ts` singleton | 0.5 d |
| **1. Data model** | `schema.prisma`, migrations, FTS generated column + GIN index, seed script | 1 d |
| **2. Auth** | argon2 + JWT + Session, `lib/auth.ts` (`requireUser`/`requireRole`), auth routes, rate limiter, AuthProvider, login page, middleware | 1.5 d |
| **3. Articles + revisions** | CRUD routes, transactional PUT w/ revision append, tags m-n, diff endpoint + lib | 2 d |
| **4. Search** | raw FTS (`websearch_to_tsquery` + `ts_rank` + `ts_headline`), `/api/search`, SearchBar | 1 d |
| **5. Frontend** | list, view, CodeMirror editor + live preview, TagNav, TagPicker, history + DiffViewer | 3 d |
| **6. Admin** | user routes + UserAdminPage + RoleGate | 1 d |
| **7. MCP import** | Filesystem MCP config, `/api/import`, parse/slug/transaction, safety guards | 1 d |
| **8. Testing** | unit + API integration (incl. authz matrix) + key component tests; ephemeral test DB; **≥80% coverage gate** | 2 d |
| **9. CI/CD** | GitHub Actions: test → build → **security (dependency audit + SAST + secret scan)** → deploy; Postgres service in CI | 1 d |
| **Buffer** | polish, a11y, security headers, docs | 1 d |
| | **Total** | **~15 working days (~3 weeks)** |

**Critical path / risk:** Phase 3 transactional revision writes and Phase 4 FTS ranking — build and test earliest.

---

## 7. Scope Boundaries — Explicitly NOT Included

- **Real-time collaborative editing** (no OT/CRDT/multi-cursor). One editor at a time; last-write-wins, history as safety net.
- **WYSIWYG rich-text editing** — Markdown source + live preview only.
- **Comments, reactions, discussion threads.**
- **Notifications** (email / in-app / push).
- **Approval / publishing workflow** beyond create/edit.
- **File / image upload & media storage** — text/Markdown only.
- **External SSO / OAuth** (SAML, Okta, Google) — self-contained local accounts only.
- **Multi-tenancy / organizations / workspaces** — single shared knowledge base.
- **Internationalization (i18n) / localization.**
- **Public / anonymous access** — all access authenticated.
- **Analytics / usage dashboards / audit log** beyond revision history.
- **AI-assisted authoring / semantic (vector) search** — keyword FTS only.
- **MCP scope** — import-only; not general file management.

---

## 8. Success Criteria

The project is complete when all of the following hold:

1. **Schema** — `prisma migrate` applies cleanly; all five tables present; `searchVector` column + GIN index exist (`\d "Article"`).
2. **Auth matrix** — automated tests confirm every protected route × {anon, VIEWER, EDITOR, ADMIN} returns the correct `200/401/403`.
3. **Revisions** — editing an article twice yields versions 2 then 3; `currentRevisionId` points to the latest; diff endpoint returns the correct delta; failed save rolls back atomically.
4. **Search** — seeded articles return ranked, snippet-highlighted results; `EXPLAIN ANALYZE` confirms the GIN index is used.
5. **XSS-safe rendering** — an article body containing `<script>` renders inert.
6. **MCP import** — dropping `.md` files in the import root creates matching articles; traversal/out-of-root paths rejected; duplicates reported.
7. **E2E smoke** — Playwright login → create → edit → search → view-history passes.
8. **Test coverage** — CI reports **≥80% line and branch coverage**; the build fails below threshold (§5).
9. **Security audit** — `npm audit` clean of high/critical advisories; SAST + secret scan pass in CI; rate limiting active on login/search; security headers present (§4).
10. **CI** — full pipeline (test → build → security → deploy) green on a PR.
11. **Documentation** — `docs/SPEC.md`, root `CLAUDE.md`, and a `README.md` (setup, env vars, run/test commands) are present and current.
12. **All acceptance criteria** in §1 pass.

---

## 9. Grading Rubric Cross-Reference

> ⚠️ **Reconcile before submission.** The official certification rubric lives
> outside this project folder and was not read while authoring this spec (work
> is scoped to `my-capstone`). The mapping below uses a **standard AI-dev
> capstone rubric** as a stand-in — replace the weights/criteria with the
> official ones and confirm each row.

| # | Rubric criterion (standard capstone) | Weight* | Where satisfied in this spec |
| --- | --- | --- | --- |
| R1 | Requirements clearly defined (user stories + acceptance criteria) | 10% | §1 (US-1…US-13 with ACs) |
| R2 | Sound data model / database design (3+ related tables) | 15% | §2.1 (5 tables, relations, FTS index) |
| R3 | Well-designed API (5+ endpoints, status codes, contracts) | 15% | §2.2 (22 endpoints, error shape, authz gating) |
| R4 | Frontend architecture (5+ components) | 10% | §2.3 (~27 components, server/client split) |
| R5 | Authentication & authorization (RBAC) | 15% | §4; US-1…US-3, US-12; §2.2 role gating; §8 #2 |
| R6 | Security & security audit | 10% | §4 (full section + CI audit); §8 #9 |
| R7 | Testing strategy & 80%+ coverage | 10% | §5 (layers + ≥80% gate); §6 Phase 8; §8 #2, #7, #8 |
| R8 | Full-text search correctness & performance | 5% | US-11; §2.1 FTS; §8 #4 |
| R9 | Version history / revision tracking | 5% | US-6/US-8/US-9; §8 #3 |
| R10 | MCP integration | 5% | §3 (MCP Integration Plan); US-13; §8 #6 |
| R11 | CI/CD pipeline | 5% | §6 Phase 9; §8 #10 |
| R12 | Documentation & code conventions | 5% | this SPEC, `CLAUDE.md`; §8 #11 |

\* Weights are illustrative placeholders. **Action:** open the certification's
official rubric and overwrite this table's criteria and weights to match, then
confirm every criterion maps to a concrete deliverable above.

### Rubric checklist (from the certification review)

| Rubric item | Spec section | Covered? |
| --- | --- | --- |
| 5+ API endpoints | §2.2 Technical Design | ✅ 22 |
| 3+ related tables | §2.1 Data Model | ✅ 5 |
| 5+ frontend components | §2.3 Component Tree | ✅ ~27 |
| 80%+ test coverage | §5 Testing Strategy | ✅ enforced gate |
| CI/CD pipeline | §6 Implementation Plan | ✅ Phase 9 |
| Security audit | §4 Security Considerations | ✅ + CI audit |
| MCP integration | §3 MCP Integration Plan | ✅ |
| Documentation | §8 Success Criteria #11 | ✅ |

---

*Related: see `CLAUDE.md` (root) for coding conventions, file structure, and the
detailed testing strategy this spec references.*
