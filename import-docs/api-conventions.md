---
title: API Design Conventions
tags: api, conventions, engineering
---

# API Design Conventions

All API routes live under `app/api/` as Next.js Route Handlers. This document
describes the conventions every handler must follow.

## Response Shape

**Success:** return the resource directly, with the correct HTTP status code.

```json
{ "article": { "id": "...", "title": "..." } }
```

**Error:** always return `{ "error": "<message>" }`. Never leak stack traces or
raw Prisma error messages.

```json
{ "error": "Article not found" }
```

## Status Codes

| Code | When |
|------|------|
| 200 | Successful GET / PUT |
| 201 | Successful POST (resource created) |
| 204 | Successful DELETE (no body) |
| 400 | Validation failure (Zod error or bad input) |
| 401 | Unauthenticated (no token / invalid token) |
| 403 | Authenticated but insufficient role |
| 404 | Resource not found |
| 409 | Conflict (duplicate slug, FK violation) |
| 500 | Unexpected server error |

## Auth Gating

Every protected handler calls `requireRole(req, Role.VIEWER)` (or higher) as
its **first** action — before reading the body, before touching the DB.

```typescript
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireRole(req, Role.VIEWER); // gate first
    // ... work
  });
}
```

## Input Validation

Use Zod schemas defined in `lib/validation.ts`. Call `.parse()` on the request
body **after** auth. Unknown fields must be rejected (`.strict()`).

## Business Logic

Keep business logic in `lib/`, not inline in route files. Route handlers
orchestrate; helpers do the work.
