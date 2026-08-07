# Phase 3 — View/Lib Split, Boundary & Contracts

**Date:** 2026-08-06  
**Follows:** [Phase 2 report](./REFACTORING_REPORT_PHASE2.md)

## Summary

Phase 3 extracted client mutation libs for persona/storybook, established a frontend catalog/DTO choke-point, removed the orphaned companion-status feature, wired Parent schedule loading/error to shared UI primitives, and added a minimal Vitest contract for `DomainError` → HTTP status.

---

## Completed

### 1. View / lib extraction (UI markup unchanged)

| Lib | Used by |
|-----|---------|
| `persona/lib/select-avatar.ts` | OnboardingFlow, WaitingRoom |
| `growth-storybook/lib/storybook-api.ts` | GrowthStorybookView (progress / compose / narrate) |
| `growth-storybook/lib/print-book.ts` | GrowthStorybookView print path |

Polly / speech fallback remains in the view.

### 2. companion-status cleanup

- Deleted `companion-status.service.ts` and `companion-status.types.ts` (no API route or UI importers).
- Parent home remains the live guardian dashboard surface.

### 3. Frontend ↔ backend boundary

- Added `src/frontend/shared/catalogs/index.ts` as the client-safe surface for:
  - `FLOWER_CATALOG` / `LEAF_CATALOG` + helpers
  - garden / wish view DTOs (`EmotionGardenResponse`, `WishTreeResponse`, memory cards, etc.)
- Emotion garden & wish-tree UI components now import from `@/frontend/shared/catalogs` instead of `@/backend/features/...`.
- Catalog *data* still lives in backend feature modules; the barrel is the architectural choke-point for a later physical move to `src/shared/`.

### 4. Parent UI primitives

- `ParentSchedulePanel` uses `LoadingSkeleton` / `ErrorState` from `ParentUi` (no inline “불러오는 중…” / rose `<p>`).

### 5. DomainError → HTTP contract tests

- Added Vitest (`vitest.config.ts`, `npm test` / `npm run test:watch`).
- `domain-error.test.ts` asserts:
  - default `VALIDATION` → 400
  - `NOT_FOUND` → 404, `CONFLICT` → 409, `FORBIDDEN` → 403

---

## Verification

- `npm test` — 5 passed
- `npm run typecheck` — clean

---

## Deferred / next

- Physically move flower/leaf catalogs + pure DTOs into `src/shared/` (barrel already points the way).
- Further WaitingRoom bond/quest orchestration libs if those views keep growing.
- Expand contract tests around `withApiGuard` response JSON shape.
- Broader Parent surfaces (profile/report) adopting `LoadingSkeleton` / `ErrorState`.
