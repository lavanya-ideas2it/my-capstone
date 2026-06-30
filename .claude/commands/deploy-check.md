Run a full pre-deployment verification of the TeamWiki codebase. Work through every gate below in order and report the result of each step. Stop immediately if any gate fails — report what failed, why, and the exact fix needed before proceeding.

## Gates (run in this order)

### 1. Lint
```
npm run lint
```
Expected: zero errors. Warnings are acceptable.

### 2. Type-check
```
npm run typecheck
```
Expected: clean exit, no type errors.

### 3. Tests with coverage
```
npm run test:coverage
```
Expected: all tests pass; statement coverage ≥ 80%; branch coverage ≥ 80%.

### 4. Production build
```
npm run build
```
Expected: clean exit. Watch for type errors that `tsc --noEmit` misses in
Next.js page/route files.

### 5. Dependency security audit
```
npm audit --audit-level=high
```
Expected: zero high or critical vulnerabilities. Moderate findings are
acceptable but must be documented.

### 6. Environment variables
Verify that every variable used in the codebase is documented in `.env.example`:
- `DATABASE_URL`
- `JWT_SECRET` (must note the 32-char minimum)
- `ACCESS_TOKEN_TTL`
- `IMPORT_ROOT`

Flag any variable present in source that is absent from `.env.example`.

### 7. Database migrations
```
npx prisma migrate status
```
Expected: "All migrations have been applied." No unapplied or failed
migrations. If a new migration was added, confirm it has been reviewed for
irreversibility (column drops, table renames, constraint changes).

### 8. Security audit status
Check `docs/SECURITY-AUDIT.md`:
- All findings listed as "✅ Fixed".
- No open MEDIUM or higher items.
- Report the date of the last audit and flag if it is older than 30 days.

### 9. Secrets scan
Search for patterns that look like committed secrets:
```
git grep -nE "(password|secret|token|key)\s*=\s*['\"][^'\"]{8,}" -- ":(exclude).env*" ":(exclude)*.test.*" ":(exclude)node_modules"
```
Expected: zero matches outside of test fixtures and `.env.example` placeholders.

### 10. Uncommitted changes
```
git status
git diff --stat
```
Expected: clean working tree. All changes committed. If there are uncommitted
changes, list them — do not block the check, but flag them as requiring a
commit before deploy.

## Report format

After running every gate, output a summary table:

| Gate | Result | Notes |
|------|--------|-------|
| Lint | ✅ / ❌ | |
| Type-check | ✅ / ❌ | |
| Tests | ✅ / ❌ | coverage % |
| Build | ✅ / ❌ | |
| Audit | ✅ / ❌ | |
| Env vars | ✅ / ❌ | |
| Migrations | ✅ / ❌ | |
| Security doc | ✅ / ❌ | last audit date |
| Secrets scan | ✅ / ❌ | |
| Git status | ✅ / ❌ | |

Then: **READY TO DEPLOY** or **BLOCKED — fix the items marked ❌ before deploying.**
