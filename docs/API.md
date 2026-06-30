# TeamWiki — API Reference

## General Conventions

**Base URL**

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:3000` |
| Production | your deployment URL |

**Content type:** all request and response bodies are JSON. Set `Content-Type: application/json` on every request with a body.

**Authentication:** include `Authorization: Bearer <accessToken>` on every protected endpoint. Access tokens are short-lived (default 15 min). Use `POST /api/auth/refresh` to obtain a new one without re-entering credentials.

**Error shape:** all errors return a consistent JSON body:
```json
{ "error": "Human-readable message" }
```

**Rate limits**

| Endpoint | Limit |
|----------|-------|
| `POST /api/auth/login` | 20 requests / IP / 15 min |
| `POST /api/auth/register` | 10 requests / IP / hour |

**Pagination:** list endpoints accept `?page=1&limit=20`. Maximum `limit` is 100.

---

## Roles

| Role | Permissions |
|------|-------------|
| `VIEWER` | Read articles, tags, search results, and revision history |
| `EDITOR` | All VIEWER permissions + create/edit articles, create/rename tags, import documents |
| `ADMIN` | All EDITOR permissions + delete articles/tags, manage users |

The role hierarchy is additive: ADMIN can do everything EDITOR can; EDITOR can do everything VIEWER can.

---

## Error Reference

| Status | Meaning |
|--------|---------|
| `400` | Validation failure, malformed JSON, or business rule violation |
| `401` | Missing, invalid, or expired access token |
| `403` | Token valid but role insufficient for this operation |
| `404` | Resource not found |
| `409` | Conflict — duplicate slug/name, or FK constraint prevents the action |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error (generic message returned; details logged server-side only) |

---

## Auth

### GET /api/auth/bootstrap

Public — no authentication required.

Tells the UI whether the first-admin bootstrap window is open (no users exist yet). The login page uses this to conditionally show the "Set up your account" link.

**Response 200**
```json
{ "needsBootstrap": true }
```
```json
{ "needsBootstrap": false }
```

---

### POST /api/auth/register

Public during bootstrap (first call ever); ADMIN-only after that.
Rate limit: 10 requests / IP / hour.

**Request body**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `email` | string | yes | valid email, max 320 chars |
| `name` | string | yes | 1–120 chars |
| `password` | string | yes | 8–200 chars |
| `role` | `"ADMIN"` \| `"EDITOR"` \| `"VIEWER"` | no | defaults to `ADMIN` on bootstrap, `VIEWER` otherwise |

```json
{
  "email": "alice@example.com",
  "name": "Alice",
  "password": "s3cur3pass!",
  "role": "EDITOR"
}
```

**Response 201**
```json
{
  "user": {
    "id": "clxyz1230000000000000000",
    "email": "alice@example.com",
    "name": "Alice",
    "role": "EDITOR",
    "createdAt": "2026-06-30T10:00:00.000Z",
    "updatedAt": "2026-06-30T10:00:00.000Z"
  }
}
```

**Error responses**

| Status | Condition |
|--------|-----------|
| `401` | Not authenticated and bootstrap window is closed |
| `403` | Authenticated but not ADMIN |
| `409` | Email already registered |
| `429` | Rate limit exceeded |

---

### POST /api/auth/login

Public. Rate limit: 20 requests / IP / 15 min.

Returns a short-lived access token in the body and sets a long-lived `refreshToken` httpOnly cookie. The error message is identical whether the email does not exist or the password is wrong — no user enumeration.

**Request body**

| Field | Type | Required |
|-------|------|----------|
| `email` | string | yes |
| `password` | string | yes |

```json
{
  "email": "alice@example.com",
  "password": "s3cur3pass!"
}
```

**Response 200**

Sets `Set-Cookie: refreshToken=<token>; HttpOnly; SameSite=Strict; Secure`.

```json
{
  "user": {
    "id": "clxyz1230000000000000000",
    "email": "alice@example.com",
    "name": "Alice",
    "role": "EDITOR",
    "createdAt": "2026-06-30T10:00:00.000Z",
    "updatedAt": "2026-06-30T10:00:00.000Z"
  },
  "accessToken": "<jwt>"
}
```

**Error responses**

| Status | Condition |
|--------|-----------|
| `401` | Invalid email or password |
| `429` | Rate limit exceeded |

---

### GET /api/auth/me

Auth required (any role).

Returns the authenticated user's current profile, freshly read from the database. Useful for re-hydrating state after a page reload.

**Response 200**
```json
{
  "user": {
    "id": "clxyz1230000000000000000",
    "email": "alice@example.com",
    "name": "Alice",
    "role": "EDITOR",
    "createdAt": "2026-06-30T10:00:00.000Z",
    "updatedAt": "2026-06-30T10:00:00.000Z"
  }
}
```

**Error responses**

| Status | Condition |
|--------|-----------|
| `401` | Missing, invalid, or expired access token |

---

### POST /api/auth/refresh

Requires a valid `refreshToken` cookie. No `Authorization` header needed.

Exchanges the cookie for a new access token and rotates the refresh token. The old refresh token is invalidated immediately on use — replaying a used token returns `401`.

**Response 200**

Sets a new `refreshToken` cookie.

```json
{ "accessToken": "<new-jwt>" }
```

**Error responses**

| Status | Condition |
|--------|-----------|
| `401` | Cookie missing, session expired, or session revoked |

---

### POST /api/auth/logout

Auth required (any role).

Revokes the current session server-side and clears the refresh cookie. After this call the access token will expire naturally within its TTL; clients should discard it immediately.

**Response 204** — no body.

---

## Articles

### GET /api/articles

Auth: VIEWER+

Returns a paginated list of articles, optionally filtered by tag slug.

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `tag` | string | — | Filter by tag slug (e.g. `engineering`) |
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Results per page (max 100) |

**Response 200**
```json
{
  "items": [
    {
      "id": "clxyz1230000000000000000",
      "slug": "getting-started",
      "title": "Getting Started",
      "body": "# Welcome\n\nBody text...",
      "authorId": "clxyz4560000000000000000",
      "createdAt": "2026-06-30T10:00:00.000Z",
      "updatedAt": "2026-06-30T11:00:00.000Z",
      "tags": [{ "id": "clxyz7890000000000000000", "name": "engineering", "slug": "engineering" }]
    }
  ],
  "total": 42,
  "page": 1
}
```

---

### POST /api/articles

Auth: EDITOR+

Creates an article and its initial revision (v1) atomically. The slug is auto-derived from the title.

**Request body**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `title` | string | yes | 1–300 chars |
| `body` | string | no | max 1,000,000 chars; defaults to `""` |
| `tagIds` | string[] | no | max 50 tag IDs; defaults to `[]` |

```json
{
  "title": "Getting Started",
  "body": "# Welcome\n\nBody text...",
  "tagIds": ["clxyz7890000000000000000"]
}
```

**Response 201**
```json
{
  "article": {
    "id": "clxyz1230000000000000000",
    "slug": "getting-started",
    "title": "Getting Started",
    "body": "# Welcome\n\nBody text...",
    "authorId": "clxyz4560000000000000000",
    "createdAt": "2026-06-30T10:00:00.000Z",
    "updatedAt": "2026-06-30T10:00:00.000Z",
    "tags": [{ "id": "clxyz7890000000000000000", "name": "engineering", "slug": "engineering" }],
    "currentRevision": {
      "id": "clxyzrev0000000000000000",
      "version": 1,
      "title": "Getting Started",
      "body": "# Welcome\n\nBody text...",
      "changeSummary": null,
      "editorId": "clxyz4560000000000000000",
      "createdAt": "2026-06-30T10:00:00.000Z"
    }
  }
}
```

**Error responses**

| Status | Condition |
|--------|-----------|
| `400` | Validation failure |
| `403` | Role is VIEWER |

---

### GET /api/articles/:id

Auth: VIEWER+

**Response 200**
```json
{
  "article": {
    "id": "clxyz1230000000000000000",
    "slug": "getting-started",
    "title": "Getting Started",
    "body": "# Welcome\n\nBody text...",
    "authorId": "clxyz4560000000000000000",
    "createdAt": "2026-06-30T10:00:00.000Z",
    "updatedAt": "2026-06-30T11:00:00.000Z"
  },
  "tags": [{ "id": "clxyz7890000000000000000", "name": "engineering", "slug": "engineering" }],
  "currentRevision": {
    "id": "clxyzrev0000000000000000",
    "version": 3,
    "title": "Getting Started",
    "body": "# Welcome\n\nUpdated body...",
    "changeSummary": "Clarify intro paragraph",
    "editorId": "clxyz4560000000000000000",
    "createdAt": "2026-06-30T11:00:00.000Z"
  }
}
```

**Error responses**

| Status | Condition |
|--------|-----------|
| `404` | Article not found |

---

### PUT /api/articles/:id

Auth: EDITOR+

Updates the article. Atomically appends a new revision (version N+1) and updates the Article row. The request body must include at least one of `title`, `body`, or `tagIds`.

**Request body**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `title` | string | no | 1–300 chars |
| `body` | string | no | max 1,000,000 chars |
| `tagIds` | string[] | no | max 50 tag IDs |
| `changeSummary` | string | no | max 500 chars; recorded in the new revision |

```json
{
  "title": "Getting Started (Revised)",
  "changeSummary": "Clarify intro paragraph"
}
```

**Response 200**
```json
{
  "article": {
    "id": "clxyz1230000000000000000",
    "slug": "getting-started",
    "title": "Getting Started (Revised)",
    "updatedAt": "2026-06-30T11:30:00.000Z"
  }
}
```

**Error responses**

| Status | Condition |
|--------|-----------|
| `400` | Body is empty (nothing to update) or validation failure |
| `403` | Role is VIEWER |
| `404` | Article not found |

---

### DELETE /api/articles/:id

Auth: ADMIN

Deletes the article and all its revisions (cascaded).

**Response 204** — no body.

**Error responses**

| Status | Condition |
|--------|-----------|
| `404` | Article not found |

---

## Revisions

### GET /api/articles/:id/revisions

Auth: VIEWER+

Returns the revision history for an article, newest first. The `body` field is omitted from the list for performance; fetch a single revision to get the full body.

**Query parameters**

| Param | Default | Description |
|-------|---------|-------------|
| `page` | `1` | Page number |
| `limit` | `20` | Max 100 |

**Response 200**
```json
{
  "revisions": [
    {
      "id": "clxyzrev3000000000000000",
      "version": 3,
      "title": "Getting Started (Revised)",
      "changeSummary": "Clarify intro paragraph",
      "editorId": "clxyz4560000000000000000",
      "createdAt": "2026-06-30T11:30:00.000Z"
    },
    {
      "id": "clxyzrev1000000000000000",
      "version": 1,
      "title": "Getting Started",
      "changeSummary": null,
      "editorId": "clxyz4560000000000000000",
      "createdAt": "2026-06-30T10:00:00.000Z"
    }
  ]
}
```

---

### GET /api/articles/:id/revisions/:revId

Auth: VIEWER+

Returns a single revision snapshot including the full body.

**Response 200**
```json
{
  "revision": {
    "id": "clxyzrev1000000000000000",
    "version": 1,
    "title": "Getting Started",
    "body": "# Welcome\n\nOriginal body text...",
    "changeSummary": null,
    "editorId": "clxyz4560000000000000000",
    "createdAt": "2026-06-30T10:00:00.000Z"
  }
}
```

**Error responses**

| Status | Condition |
|--------|-----------|
| `404` | Article or revision not found |

---

## Diff

### GET /api/articles/:id/diff

Auth: VIEWER+

Computes a line-by-line diff between two revision versions. The diff is calculated on the fly and never stored.

**Query parameters**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | integer | yes | Version number of the older revision |
| `to` | integer | yes | Version number of the newer revision |

**Example:** `GET /api/articles/clxyz1230000000000000000/diff?from=1&to=3`

**Response 200**
```json
{
  "fromVersion": 1,
  "toVersion": 3,
  "lines": [
    { "type": "equal", "text": "# Welcome" },
    { "type": "equal", "text": "" },
    { "type": "remove", "text": "Original intro paragraph." },
    { "type": "add", "text": "Revised intro paragraph — clearer." },
    { "type": "equal", "text": "" },
    { "type": "add", "text": "New section added here." }
  ]
}
```

Line types: `"equal"` | `"add"` | `"remove"`.

**Error responses**

| Status | Condition |
|--------|-----------|
| `404` | Article or either revision version not found |

---

## Tags

### GET /api/tags

Auth: VIEWER+

Returns all tags in alphabetical order with article counts.

**Response 200**
```json
{
  "tags": [
    {
      "id": "clxyz7890000000000000000",
      "name": "engineering",
      "slug": "engineering",
      "articleCount": 7
    },
    {
      "id": "clxyzabc0000000000000000",
      "name": "onboarding",
      "slug": "onboarding",
      "articleCount": 2
    }
  ]
}
```

---

### POST /api/tags

Auth: EDITOR+

Creates a tag. The slug is automatically derived from the name.

**Request body**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | yes | 1–60 chars |

```json
{ "name": "engineering" }
```

**Response 201**
```json
{
  "tag": {
    "id": "clxyz7890000000000000000",
    "name": "engineering",
    "slug": "engineering"
  }
}
```

**Error responses**

| Status | Condition |
|--------|-----------|
| `409` | Tag name or derived slug already exists |

---

### PUT /api/tags/:id

Auth: EDITOR+

Renames a tag. The slug is re-derived from the new name.

**Request body**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | yes | 1–60 chars |

```json
{ "name": "platform-engineering" }
```

**Response 200**
```json
{
  "tag": {
    "id": "clxyz7890000000000000000",
    "name": "platform-engineering",
    "slug": "platform-engineering"
  }
}
```

**Error responses**

| Status | Condition |
|--------|-----------|
| `404` | Tag not found |
| `409` | New name clashes with another existing tag |

---

### DELETE /api/tags/:id

Auth: ADMIN

Deletes a tag and removes it from all articles.

**Response 204** — no body.

**Error responses**

| Status | Condition |
|--------|-----------|
| `404` | Tag not found |

---

## Search

### GET /api/search

Auth: VIEWER+

Full-text search over article titles and bodies using PostgreSQL `websearch_to_tsquery` with `ts_rank` relevance ordering. Results include a sanitized HTML snippet with matched terms wrapped in `<mark>` tags.

**Query parameters**

| Param | Type | Required | Constraints |
|-------|------|----------|-------------|
| `q` | string | yes | 1–500 chars; supports `websearch_to_tsquery` syntax (`"exact phrase"`, `OR`, `-exclude`) |
| `page` | integer | no | default `1` |
| `limit` | integer | no | default `20`, max `100` |

**Example:** `GET /api/search?q=postgres+indexing&page=1&limit=10`

**Response 200**
```json
{
  "items": [
    {
      "id": "clxyz1230000000000000000",
      "slug": "postgres-indexing",
      "title": "PostgreSQL Indexing",
      "snippet": "...GIN indexes accelerate <mark>full-text</mark> searches significantly...",
      "rank": 0.0759904
    }
  ],
  "total": 3,
  "page": 1
}
```

Snippets are XSS-safe: all HTML is stripped except bare `<mark>` and `</mark>` tags. Attribute injection (e.g. `<mark onclick=...>`) is also removed.

---

## Import (MCP-backed)

The import feature uses the Filesystem MCP server to read `.md` files from the `./import-docs/` directory. Files may include YAML front-matter with `title` and `tags` fields; if `title` is absent the filename is used. If a tag named in front-matter does not exist it is created automatically. Articles with a slug that already exists are skipped.

### GET /api/import/list

Auth: EDITOR+

Lists the `.md` files currently available in the import root.

**Response 200**
```json
{
  "files": ["getting-started.md", "onboarding.md", "architecture.md"]
}
```

---

### POST /api/import

Auth: EDITOR+

Imports one or more files from the import root into TeamWiki as articles. Each file creates one Article and its v1 Revision atomically.

**Request body**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `files` | string[] | yes | 1–100 filenames from the import root |

```json
{
  "files": ["getting-started.md", "onboarding.md"]
}
```

**Response 201**
```json
{
  "created": ["getting-started.md"],
  "skipped": [
    { "file": "onboarding.md", "reason": "slug already exists" }
  ]
}
```

**Error responses**

| Status | Condition |
|--------|-----------|
| `400` | No files provided, or more than 100 files |
| `403` | Role is VIEWER |

---

## Admin

### GET /api/admin/users

Auth: ADMIN

Returns all users. Password hashes are never included.

**Response 200**
```json
{
  "users": [
    {
      "id": "clxyz4560000000000000000",
      "email": "alice@example.com",
      "name": "Alice",
      "role": "ADMIN",
      "createdAt": "2026-06-30T09:00:00.000Z",
      "updatedAt": "2026-06-30T09:00:00.000Z"
    }
  ]
}
```

---

### PATCH /api/admin/users/:id

Auth: ADMIN

Updates a user's role, name, or both. At least one field is required.

**Request body**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `role` | `"ADMIN"` \| `"EDITOR"` \| `"VIEWER"` | no | — |
| `name` | string | no | 1–120 chars |

```json
{ "role": "EDITOR" }
```

**Response 200**
```json
{
  "user": {
    "id": "clxyz4560000000000000000",
    "email": "alice@example.com",
    "name": "Alice",
    "role": "EDITOR",
    "createdAt": "2026-06-30T09:00:00.000Z",
    "updatedAt": "2026-06-30T12:00:00.000Z"
  }
}
```

**Error responses**

| Status | Condition |
|--------|-----------|
| `400` | Body empty (nothing to update) |
| `404` | User not found |

---

### DELETE /api/admin/users/:id

Auth: ADMIN

Deletes a user account. Two safety guards:
1. An admin cannot delete their own account (prevents lockout).
2. A user who owns articles or revisions cannot be deleted (FK constraint) — reassign or delete their content first.

**Response 204** — no body.

**Error responses**

| Status | Condition |
|--------|-----------|
| `400` | Attempting to delete your own account |
| `404` | User not found |
| `409` | User still owns articles or revisions |
