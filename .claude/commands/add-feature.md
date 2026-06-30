Scaffold a complete new feature for TeamWiki. The feature name and description are provided below.

**Feature:** $ARGUMENTS

---

Follow every convention in CLAUDE.md exactly. Work through the steps below in order.

## Step 1 — Define the feature

Before writing any code, state:
1. The resource name (singular noun, PascalCase for Prisma, plural lowercase for routes) — e.g. `Comment` / `comments`
2. The role minimum required to read it (usually `VIEWER`)
3. The role minimum required to write it (usually `EDITOR`)
4. The fields that belong in the Prisma model
5. Any relations to existing models (`Article`, `User`, `Tag`, `Revision`)
6. The API endpoints needed (list the HTTP method, path, and role for each)
7. The React components needed

## Step 2 — Database schema

Add the new Prisma model to `prisma/schema.prisma`.

Rules:
- Model name: `PascalCase` singular
- Fields: `camelCase`
- Enum values: `SCREAMING_SNAKE_CASE`
- Always include `id String @id @default(cuid())`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
- Add `@@map("snake_case_table_name")` if the resource name is a reserved SQL word
- Add relations to existing models using `@relation`
- Do NOT manually edit the DB — generate a migration instead

After editing the schema, run:
```
npx prisma migrate dev --name add-<resource>
npx prisma generate
```

## Step 3 — Zod validation schemas

Add validation schemas to `lib/validation.ts` following the existing pattern.

Required schemas:
- `create<Resource>Schema` — all required fields, with `min`/`max` on every string and array
- `update<Resource>Schema` — all fields optional; add `.refine()` if the body must have at least one field

Example pattern (adapt field names):
```typescript
export const createCommentSchema = z.object({
  body: z.string().min(1, "Body is required").max(10_000, "Body too long"),
  articleId: z.string().cuid("Invalid article ID"),
});

export const updateCommentSchema = z
  .object({ body: z.string().min(1).max(10_000) })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: "Nothing to update" });
```

## Step 4 — API route handlers

Create route files under `app/api/<resource>/`:

### `app/api/<resource>/route.ts`
- `GET` — list all (apply `VIEWER` check); support pagination via `?page=&limit=`
- `POST` — create (apply `EDITOR` check); parse body through `create<Resource>Schema`; return 201

### `app/api/<resource>/[id]/route.ts`
- `GET` — get by ID (`VIEWER`)
- `PUT` — update (`EDITOR`); parse body through `update<Resource>Schema`; return 200
- `DELETE` — delete (`ADMIN`); return 204

Route handler pattern to follow:
```typescript
import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createResourceSchema } from "@/lib/validation";
import { Role } from "@prisma/client";

export function GET(req: Request) {
  return handleRoute(async () => {
    await requireRole(req, Role.VIEWER);
    const items = await prisma.resource.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(items);
  });
}

export function POST(req: Request) {
  return handleRoute(async () => {
    await requireRole(req, Role.EDITOR);
    const body = await readJson(req, createResourceSchema);
    const item = await prisma.resource.create({ data: body });
    return NextResponse.json(item, { status: 201 });
  });
}
```

Import `readJson` and `handleRoute` from `@/lib/http`.

## Step 5 — TypeScript types

Add shared types to `types/index.ts` (or create `types/<resource>.ts`):
```typescript
import type { Prisma } from "@prisma/client";
export type ResourceWithRelations = Prisma.ResourceGetPayload<{
  include: { author: true }; // adjust
}>;
```

Derive from Prisma payloads — do NOT hand-write DB shapes.

## Step 6 — React components

Create components in `components/` using PascalCase filenames:

| Component | Purpose |
|-----------|---------|
| `<Resource>List.tsx` | Renders a list of items; fetches from `GET /api/<resource>` |
| `<Resource>Form.tsx` | Create/edit form; calls `POST` or `PUT` |
| `<Resource>Card.tsx` | Single item display (if shown in a list) |

Component conventions:
- `"use client"` directive at top if it uses state/effects
- Tailwind utility classes; no `@apply`
- All strings validated before submission (disable submit while loading, surface API errors)
- Use `useAuth()` from `@/components/AuthProvider` to get the current user's role
- Hide write actions from `VIEWER` role: `{canEdit && <button>...}</button>}`

## Step 7 — Page route

Create `app/(app)/<resource>/page.tsx` (list view) and optionally `app/(app)/<resource>/[id]/page.tsx` (detail view).

Follow the existing pattern in `app/(app)/articles/page.tsx`.

## Step 8 — Tests

### API integration test (`tests/api/<resource>.test.ts`)

Cover every endpoint:
1. `GET` list — 200, returns array
2. `POST` create — 201 as EDITOR, 403 as VIEWER, 400 with invalid body
3. `GET` by ID — 200, 404 for missing ID
4. `PUT` update — 200 as EDITOR, 403 as VIEWER, 400 with empty body
5. `DELETE` — 204 as ADMIN, 403 as EDITOR, 404 for missing ID
6. Two edge cases specific to this resource's business logic

Use `createUser`, `createSession`, `authedReq`, and `resetDb` from `tests/helpers.ts`.

### Unit tests for any business logic in `lib/`

If the feature adds helpers to `lib/` (transformers, validators), add unit tests in `lib/<helper>.test.ts`.

## Step 9 — Verify

Run all checks before declaring done:

```bash
npx prisma generate          # ensure client is up to date
npm run lint                 # zero errors
npm run typecheck            # zero type errors
npm test                     # all tests pass, coverage ≥ 80%
```

Fix every lint or type error before reporting completion.

## Step 10 — Report

When done, output a summary table:

| Artifact | Path | Status |
|----------|------|--------|
| Schema migration | `prisma/migrations/…` | ✅ |
| Validation schemas | `lib/validation.ts` | ✅ |
| Route: list/create | `app/api/<resource>/route.ts` | ✅ |
| Route: read/update/delete | `app/api/<resource>/[id]/route.ts` | ✅ |
| Types | `types/<resource>.ts` | ✅ |
| Components | `components/<Resource>*.tsx` | ✅ |
| Page | `app/(app)/<resource>/page.tsx` | ✅ |
| API tests | `tests/api/<resource>.test.ts` | ✅ (N tests) |

Then state the total number of new tests added and the post-scaffold coverage percentage.
