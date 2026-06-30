Run a targeted security audit of the TeamWiki codebase. Cover every dimension listed below, fix every issue you find, and update `docs/SECURITY-AUDIT.md` with the results.

## Scope

Audit every file under `app/api/`, `lib/`, and `middleware.ts`. Also check
`next.config.mjs` for HTTP security headers.

## Dimensions to check

### 1. Authentication & authorization
For every route handler:
- Does every non-public route call `requireRole(req, Role.X)` before doing any work?
- Are HTTP methods that mutate state (`POST`, `PUT`, `PATCH`, `DELETE`) protected at EDITOR or ADMIN level?
- Is there any path where a VIEWER can trigger a write?
- Does any route trust role information from the request body instead of the verified JWT?

### 2. Input validation
For every route that reads a request body or query params:
- Is the body parsed through a Zod schema from `lib/validation.ts`?
- Do string fields have both `min` and `max` bounds?
- Do array fields have a `max` count?
- Are numeric fields coerced and range-checked?
- Could any unvalidated value reach the database or filesystem?

### 3. SQL and query injection
- Are all raw `$queryRaw` / `$executeRaw` calls using `Prisma.sql` template tags (never string concatenation)?
- Is user input ever interpolated directly into a query string?

### 4. XSS
- Does any API endpoint reflect user-supplied content in a way that could be interpreted as HTML?
- Does `lib/search.ts` `sanitizeSnippet()` correctly strip all HTML except bare `<mark>` tags?
- Does the Markdown renderer use `rehype-sanitize`?

### 5. Path traversal (import pipeline)
- Does `lib/import.ts` `resolveWithinRoot()` reject all paths that resolve outside `IMPORT_ROOT`?
- Is the MCP server scoped to `./import-docs` in `.mcp.json`?

### 6. HTTP security headers (`next.config.mjs`)
Verify these headers are present and correctly configured:
- `Content-Security-Policy` — `default-src 'self'`, no wildcard origins
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN` or `frame-ancestors 'self'` in CSP
- `Strict-Transport-Security` — max-age ≥ 1 year, `includeSubDomains`
- `Referrer-Policy`
- `Permissions-Policy`
- `poweredByHeader: false` in `next.config.mjs`

### 7. Hardcoded secrets
Run:
```
git grep -nE "(secret|password|token|key)\s*[:=]\s*['\"][^'\"]{8,}" \
  -- ":(exclude).env*" ":(exclude)*.test.*" ":(exclude)node_modules" \
     ":(exclude)docs/"
```
Flag any match that is not a safe placeholder (e.g., `change-me-in-production`).

### 8. Rate limiting
- Is `/api/auth/login` rate-limited? What are the limits?
- Is `/api/auth/register` rate-limited?
- Is `lib/ratelimit.ts` using an in-process Map (note the multi-instance limitation)?

### 9. Open redirects
- Does the login page validate the `?from=` parameter before calling `router.replace`?
- Could any other redirect in the codebase be influenced by user-supplied URLs?

### 10. Dependency audit
```
npm audit --audit-level=moderate
```
Report all moderate, high, and critical findings with their advisory URLs.

## After the scan

1. Fix every issue found.
2. Run `npm test` to confirm no regressions.
3. Run `npm run lint && npm run typecheck` to confirm code quality.
4. Update `docs/SECURITY-AUDIT.md`:
   - Add new findings to the summary table with severity, file, line, finding, and "✅ Fixed" or "⚠️ Accepted risk" status.
   - Update the report date at the top.
   - Move any now-fixed items from "Recommendations" to the fixed findings table.

If no new issues are found, add a dated "Re-scan: no new findings" entry to `docs/SECURITY-AUDIT.md`.
