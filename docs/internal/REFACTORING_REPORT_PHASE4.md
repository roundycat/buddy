# Phase 4 — Shared Catalogs, Client Types & Guard Contracts

**Date:** 2026-08-06  
**Follows:** [Phase 3 report](./REFACTORING_REPORT_PHASE3.md)

## Summary

Phase 4 physically moved flower/leaf catalogs and garden/wish DTOs into `src/shared/`, closed remaining `"use client"` → `@/backend` type leaks via frontend type barrels, deleted unused `@/services` / `@/types` facades, expanded Parent `ErrorState` usage, and added `withApiGuard` HTTP contract tests.

---

## Completed

### 1. Canonical shared catalogs / DTOs

| Canonical | Backend shim (compat) |
|-----------|------------------------|
| `src/shared/emotion-garden/types.ts` | `emotion-garden.types.ts` → re-export |
| `src/shared/emotion-garden/flowers.ts` | `emotion-garden.flowers.ts` → re-export |
| `src/shared/wish-tree/types.ts` | `wish-tree.types.ts` → re-export |
| `src/shared/wish-tree/leaves.ts` | `wish-tree.leaves.ts` → re-export |

`@/frontend/shared/catalogs` now imports from `@/shared/*` (not backend).

### 2. Client DTO barrels

`src/frontend/shared/types/*` — growth-storybook, adventure-quest, picture-diary, photo-album, memory-post, parent, wallet.  
Client components import these instead of `@/backend/features/...`.

### 3. Dead facade removal

- Deleted unused `src/services/index.ts` and `src/types/index.ts` (zero importers).

### 4. Parent ErrorState

- `ParentProfileSettings`, `ParentReportView`, `StorybookLetterCard` (errors only; notices stay slate).

### 5. `withApiGuard` contract tests

- `route.test.ts`: success JSON, DomainError status map, HttpError, UnauthorizedError, unknown → fallback.
- Vitest stubs `server-only` for Node runs (`src/test/stubs/server-only.ts`).

---

## Verification

- `npm test` — 13 passed  
- `npm run typecheck` — clean  

---

## Deferred / next

- Move remaining feature DTOs (parent full set, wallet, storybook) into `src/shared/` (barrels already isolate clients).
- Thin media/progress routes that still hit stores directly.
- Optional ESLint rule: ban `@/backend` imports from `"use client"` files.
