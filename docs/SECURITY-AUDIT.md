# TeamWiki — Security Audit Report

**Date:** 2026-06-30  
**Scope:** All API route handlers (`app/api/**`), authentication helpers (`lib/auth.ts`),
search (`lib/search.ts`), import pipeline (`lib/import.ts`), middleware (`middleware.ts`),
HTTP response headers (`next.config.mjs`), and frontend session handling.  
**Auditor:** Automated review via Claude Code  
**Result:** 6 findings fixed · 0 open critical/high · passes lint, typecheck, and full test suite (124 tests)

---

## Summary Table

| # | Severity | File | Line | Finding | Status |
|---|----------|------|------|---------|--------|
| 1 | **MEDIUM** | `app/api/auth/login/route.ts` | 16 | No rate limiting — brute-force password attacks | ✅ Fixed |
| 2 | **MEDIUM** | `app/api/auth/register/route.ts` | 13 | No rate limiting on register endpoint | ✅ Fixed |
| 3 | **MEDIUM** | `next.config.mjs` | — | Missing Content-Security-Policy header | ✅ Fixed |
| 4 | **LOW** | `app/(auth)/login/page.tsx` | 13 | Open redirect via unvalidated `?from=` parameter | ✅ Fixed |
| 5 | **LOW** | `lib/validation.ts` | 96 | Search query `q` has no max length — DB load vector | ✅ Fixed |
| 6 | **LOW** | `lib/validation.ts` | 83 | Import `files` array has no max count — loop DoS | ✅ Fixed |

---

## Confirmed-Safe Areas (No Action Required)

| Area | Verdict |
|------|---------|
| **SQL injection** | All raw queries use `Prisma.sql` template tags; all ORM queries use parameterized bindings. User input is never string-interpolated into SQL. `lib/search.ts:38` explicitly notes this. |
| **XSS via search snippets** | `sanitizeSnippet()` (`lib/search.ts:28`) strips all HTML tags except bare `<mark>`/`</mark>`. Attribute injection like `<mark onclick=…>` is also removed by the negative-lookahead regex because the tag content (`mark onclick…`) does not match `\/?mark>`. |
| **XSS in article rendering** | `MarkdownRenderer` uses `react-markdown` + `rehype-sanitize`, which allowlists only safe HTML elements and removes scripts, event handlers, and unsafe attributes. |
| **Password storage** | argon2id via the `argon2` package with its secure default parameters (time cost 3, memory 64 MiB). Passwords are never returned in any API response. |
| **Refresh token security** | 48-byte cryptographically random tokens (`randomBytes(48)`), SHA-256 hashed before storage. The plaintext token only ever appears in the httpOnly cookie; the DB stores only the hash. |
| **Token rotation** | Refresh token rotated on every `/api/auth/refresh` call; old hash replaced atomically. Replay with a used token returns 401. |
| **Cookie flags** | `refreshToken` cookie: `httpOnly: true`, `sameSite: "strict"`, `secure: true` in production. `SameSite=Strict` eliminates CSRF risk on the cookie-only endpoints (refresh, logout). |
| **Sensitive data in responses** | `passwordHash` is excluded at the Prisma `select` level in every user-returning query. `toPublicUser()` explicitly allowlists the returned fields. |
| **Generic auth errors** | Login always returns "Invalid credentials" regardless of whether the email exists, preventing user enumeration (AC1.2). |
| **Role source** | The role is read from the verified, signed JWT — never trusted from the request body or query parameters. |
| **Admin self-delete** | `DELETE /api/admin/users/:id` returns 400 if `id === admin.id`, preventing a last-admin lockout. |
| **Error leakage** | `handleRoute` catches all unhandled errors and returns a generic "Internal server error" with status 500. Stack traces and DB error codes are logged server-side only. |
| **CORS** | No `Access-Control-Allow-Origin` headers are set. Cross-origin requests are blocked by browser policy. No wildcard CORS is present anywhere. |
| **Hardcoded secrets** | No credentials in source. `JWT_SECRET` is read from the environment at startup; `secretKey()` (`lib/auth.ts:36`) enforces a 32-character minimum and throws if the secret is absent or too short. |
| **Path traversal (import)** | `resolveWithinRoot()` (`lib/import.ts:45`) rejects any resolved path outside `IMPORT_ROOT`. The MCP filesystem server enforces the same boundary at the OS layer as a second defense. |
| **Existing security headers** | `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security` (2-year HSTS), `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy` were already set before this audit. |
| **IDOR / ownership** | By design: TeamWiki is a collaborative wiki — any EDITOR may update any article. Article and tag DELETE are restricted to ADMIN. Revision history is read-only for all. |
| **Pagination abuse** | All list endpoints enforce `limit: max(100)` via Zod; no unbounded queries. |

---

## Finding Detail and Fix Applied

---

### Finding 1 · MEDIUM — No rate limiting on `/api/auth/login`

**File:** `app/api/auth/login/route.ts` · **Line:** 16 (before fix)

**Description:**  
The login endpoint accepted unlimited requests from a single IP with no throttling. An attacker with a list of known email addresses could run a dictionary or credential-stuffing attack against every account with no server-side resistance.

**Fix — new file `lib/ratelimit.ts`:**  
A sliding-window in-process rate limiter tracks request timestamps per keyed bucket.

```typescript
export function checkRateLimit(key: string, max: number, windowMs: number): boolean
export function clientIp(req: Request): string   // first hop from x-forwarded-for
```

**Fix — `app/api/auth/login/route.ts`:**  
Gate of 20 attempts per IP per 15 minutes added at the top of the handler:

```typescript
if (!checkRateLimit(`login:${clientIp(req)}`, 20, 15 * 60_000)) {
  throw tooManyRequests("Too many login attempts. Please try again later.");
}
```

`tooManyRequests` (HTTP 429) added to `lib/http.ts`.

**Limitation:** In-process `Map` resets on restart and is not shared across multiple server processes. For multi-instance production deployments, replace with a Redis-backed sliding window (see §Recommendations).

---

### Finding 2 · MEDIUM — No rate limiting on `/api/auth/register`

**File:** `app/api/auth/register/route.ts` · **Line:** 13 (before fix)

**Description:**  
The register endpoint had no throttle. During the bootstrap window (before the first user exists) an attacker who discovers the URL could race to claim the first ADMIN account. After bootstrap, a compromised ADMIN credential could be scripted to bulk-create accounts.

**Fix:**  
Gate of 10 attempts per IP per hour:

```typescript
if (!checkRateLimit(`register:${clientIp(req)}`, 10, 60 * 60_000)) {
  throw tooManyRequests("Too many registration attempts. Please try again later.");
}
```

---

### Finding 3 · MEDIUM — Missing Content-Security-Policy header

**File:** `next.config.mjs`

**Description:**  
The response headers included `X-Frame-Options`, `X-Content-Type-Options`, HSTS, `Referrer-Policy`, and `Permissions-Policy`, but no `Content-Security-Policy`. Without a CSP, any XSS that bypassed application-level sanitization — for example, through a future dependency vulnerability — would execute without browser restriction.

**Fix:**

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self';
  frame-ancestors 'self';
  base-uri 'self';
  form-action 'self'
```

Also added `poweredByHeader: false` to `next.config.mjs` to suppress `X-Powered-By: Next.js` fingerprinting.

**Note on `'unsafe-inline'`:** Next.js App Router injects inline hydration scripts that cannot be predicted at build time, requiring `'unsafe-inline'` in `script-src`. A nonce-based CSP (removing `'unsafe-inline'`) is the recommended upgrade for production (see §Recommendations).

---

### Finding 4 · LOW — Open redirect via `?from=` parameter

**File:** `app/(auth)/login/page.tsx` · **Line:** 13 (before fix)

**Description:**  
After successful login, the page called `router.replace(from)` where `from` came directly from `searchParams.get("from")`. An attacker could construct a phishing URL:

```
https://teamwiki.internal/login?from=//evil.com/fake-login
```

A protocol-relative URL (`//evil.com`) inherits the current scheme; after a successful login the browser would navigate to `https://evil.com`. This enables a "login CSRF" phishing chain where the victim lands on a page impersonating TeamWiki's post-login view.

Note: the middleware's own redirect code sets `from` to `pathname` (always starts with `/`), so the vulnerability is only reachable via a manually crafted link, not through normal browsing.

**Fix:**

```typescript
const rawFrom = searchParams.get("from") ?? "/";
// Reject protocol-relative (//host) and absolute (https://…) URLs.
const from = rawFrom.startsWith("/") && !rawFrom.startsWith("//") ? rawFrom : "/";
```

---

### Finding 5 · LOW — Search query has no maximum length

**File:** `lib/validation.ts` · **Line:** 96

**Description:**  
`searchQuery` validated `q` with only `min(1)` and no upper bound. A query of tens of thousands of characters would be sent verbatim to Postgres's `websearch_to_tsquery`. While injection-safe (parameterized), the parser must process every character, creating unnecessary DB CPU load.

**Fix:**

```typescript
q: z.string().min(1, "Query is required").max(500, "Query too long"),
```

---

### Finding 6 · LOW — Import `files` array has no maximum count

**File:** `lib/validation.ts` · **Line:** 83

**Description:**  
`importSchema.files` accepted arrays of any length. An authenticated EDITOR could submit a list of 10,000 filenames. Even if none existed, `importFiles()` iterates through all of them in a serial loop, holding the HTTP request open for the duration.

**Fix:**

```typescript
files: z
  .array(z.string().min(1))
  .min(1, "No files provided")
  .max(100, "Maximum 100 files per import request"),
```

---

## Recommendations for Production Hardening

These are informational — not implemented because they require infrastructure outside the capstone scope.

| Priority | Topic | Recommendation |
|----------|-------|---------------|
| High | Rate limiter persistence | Replace `lib/ratelimit.ts` in-process `Map` with Redis + a sliding-window algorithm (e.g., `@upstash/ratelimit`) so limits survive restarts and span multiple instances. |
| High | Nonce-based CSP | Generate a per-request cryptographic nonce in Next.js middleware; inject `nonce-{value}` into `script-src` and remove `'unsafe-inline'`. This closes the last theoretical inline-script XSS path. |
| Medium | `x-forwarded-for` trust | Configure the application to trust only the load-balancer's forwarded IP, not client-supplied `x-forwarded-for` values (prevents IP spoofing to bypass the rate limiter). |
| Medium | Per-email login throttle | Add a secondary rate limit keyed on the target email address (`login:email:{email}`) to protect individual accounts against distributed credential-stuffing attacks that rotate source IPs. |
| Low | Expired session cleanup | Add a scheduled job to `DELETE FROM "Session" WHERE "expiresAt" < NOW()` to prevent unbounded growth of the session table. |
| Low | Audit log | Emit an append-only event for authentication events (login, logout, failed login, role change, article delete) for incident-response readability. |
| Low | Password breach check | On registration, optionally check the provided password against the HaveIBeenPwned k-anonymity API to reject known-compromised passwords. |
