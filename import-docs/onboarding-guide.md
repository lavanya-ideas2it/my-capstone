---
title: Engineering Onboarding Guide
tags: onboarding, engineering, process
---

# Engineering Onboarding Guide

Welcome to the engineering team! This guide will walk you through everything
you need to get up and running in your first week.

## Day 1: Environment Setup

1. Clone the main repository and follow the README
2. Set up your local `.env` from `.env.example`
3. Run `npm install` and `npm run db:seed` to seed the development database
4. Start the dev server with `npm run dev` and verify it loads at `localhost:3000`

## Day 2–3: Codebase Walkthrough

The project follows a **Next.js App Router** structure:

- `app/api/` — Route Handlers (backend, one file per resource)
- `app/(app)/` — Authenticated frontend pages
- `lib/` — Shared server-side logic (auth, search, articles, etc.)
- `components/` — Reusable React components
- `prisma/` — Schema and migrations

## Coding Standards

- TypeScript strict mode — no `any`
- Zod validation at every API boundary
- All DB mutations go through Prisma (no raw SQL except FTS)
- Tests before implementation (TDD)

## Useful Commands

| Command | Purpose |
|---|---|
| `npm test` | Run the full test suite |
| `npm run typecheck` | TypeScript check without building |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Re-seed the dev database |
