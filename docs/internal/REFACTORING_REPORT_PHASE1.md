# Phase 1 — Architecture & Clean Code Refactoring Report

**Project:** Bedi (Beddy)  
**Date:** 2026-08-06  
**Scope:** Architecture review + safe clean-code refactoring. No UI redesign, no feature removal, no intentional breaking API contract changes.

---

## Executive summary

Phase 1 standardized API error handling, introduced domain errors for services, extracted shared media validation and client fetch/hooks, separated memory-post persistence from business logic, removed orphaned UI files, and documented remaining technical debt for Phase 2.

---

## Findings (pre-refactor)

| Area | Status |
|------|--------|
| Feature folders (`backend/features/*`) | Solid boundaries |
| API guards | Split: `withApiGuard` vs manual try/catch (garden, timeline, etc.) |
| Persist layer | Mostly `*.store.ts`; one service inlined map-store |
| Frontend hooks | Only 3; fetch/busy/error duplicated in Views |
| `any` types | Effectively absent (already clean) |
| Dead UI | Guardian legacy views, HospitalDayView, FlowerPot, TimelineFeed, etc. |
| Facades `@/services`, `@/types` | Unused by routes |
| Blob stores | Shared `blob-store` + 3 legacy S3 helpers still duplicated |

---

## What changed

### 1. API layer / Controllers (lightweight)

- Migrated to `withApiGuard`:
  - `garden/plant`, `garden/water`, `garden/care`, `garden/storybook`
  - `garden/flower/[id]`, `wish/leaf/[id]`
  - `timeline`, `growth`, `memory`
- Success shape unchanged: domain JSON as before.
- Failure shape unchanged: `{ error: string }` with appropriate status.

### 2. Domain errors (SOLID — services ≠ HTTP)

- Added `DomainError` + `domainStatus` (`backend/shared/http/domain-error.ts`).
- `withApiGuard` maps `DomainError` → 400/403/404/409.
- Emotion garden service throws `DomainError` instead of raw `Error` + route regex guessing.

### 3. DRY — image upload

- Added `backend/shared/media/image-upload.ts`.
- Diary, photo album, storybook parent letter reuse decode / MIME / size checks.

### 4. Repository / Store separation

- Extracted `memory-post.store.ts` from `memory-post.service.ts`.
- Account delete now also clears memory letters.

### 5. Frontend shared API & hooks (UI unchanged)

- `frontend/shared/api/fetch-json.ts` — typed API client + `ApiRequestError`
- `frontend/shared/hooks/useAsyncAction.ts`
- `frontend/shared/hooks/useJsonResource.ts`
- Adopted in: WishTreeView, EmotionGardenView, StorybookLetterCard, LoginForm
- Wish/Garden flash timers → `useTransientToast`

### 6. Dead code removed

Deleted unused components (no importers):

- `HospitalDayView.tsx`
- `TimelineFeed.tsx`
- `GuardianDashboardView.tsx`, `GuardianPageShell.tsx`, `GuardianBrandBar.tsx`
- `FlowerPot.tsx`, `StorybookFlower.tsx`
- `ChildSummaryCard.tsx`

Removed unused deprecated exports:

- `BEDI_COMPANION_SYSTEM_PROMPT`
- `formatProfileForPrompt`
- Facade exports of `careForPlant`, `getCompanionStatusDashboard`

### 7. Naming / facade hygiene

- Backend `fetch-json.ts`: `ExternalHttpError` / `fetchExternalJson` (no clash with route `HttpError`).
- `src/services/index.ts` clarified as optional facade (routes keep feature imports).

---

## Files modified (primary)

**Added**

- `src/backend/shared/http/domain-error.ts`
- `src/backend/shared/media/image-upload.ts`
- `src/backend/features/memory-post/memory-post.store.ts`
- `src/frontend/shared/api/fetch-json.ts`
- `src/frontend/shared/hooks/useAsyncAction.ts`
- `src/frontend/shared/hooks/useJsonResource.ts`
- `docs/REFACTORING_REPORT_PHASE1.md` (this report)

**Updated (selected)**

- `src/backend/shared/http/route.ts`
- `src/backend/shared/http/fetch-json.ts`
- `src/backend/features/emotion-garden/emotion-garden.service.ts`
- `src/backend/features/picture-diary/picture-diary.service.ts`
- `src/backend/features/photo-album/photo-album.service.ts`
- `src/backend/features/growth-storybook/storybook-parent-letter.service.ts`
- `src/backend/features/memory-post/memory-post.service.ts`
- `src/backend/features/auth/auth.delete.service.ts`
- `src/backend/features/persona/persona.store.ts`
- `src/backend/ai/prompts/companion.ts`
- Garden / wish / timeline / growth / memory API routes
- `WishTreeView`, `EmotionGardenView`, `StorybookLetterCard`, `LoginForm`
- `src/services/index.ts`

**Deleted**

- 8 orphaned frontend component files (listed above)

---

## Technical debt remaining

1. **Legacy blob stores** — `avatar.store`, `photo-album.store`, `schedule-image.store` still duplicate S3/local helpers; migrate to `blob-store`.
2. **Route → store bypass** — several media/progress routes still hit stores directly; wrap behind thin services.
3. **`DomainError` adoption** — only garden fully migrated; diary/wish/hospital/parent still use `Error` + route `HttpError` wrapping.
4. **Large View components** — OnboardingFlow, ParentSchedulePanel, GrowthStorybookView, WaitingRoom still hold mutation orchestration (extract libs/hooks gradually).
5. **`companion-status.service`** — orphaned aggregation (no API/UI); delete or wire to guardian.
6. **Empty API dirs** — `dev/garden-clock`, `dev/mission-agent`, `garden/visitor`, `persona/setup`.
7. **Memory card placeholders** — `drawingAvailable` / `voiceAvailable` still false stubs.
8. **Frontend → backend type imports** — several Views import `@/backend/features/*/types` (boundary leak); move DTOs into `frontend/shared/types`.
9. **bedi vs Beddy naming** — infra (`bedi`) vs character (`Beddy`) remains mixed by design; document, don’t force rename.
10. **`@/types` facade** — still unused; either adopt or remove in Phase 2.
11. **Params typing** — some dynamic routes use `Promise<{id}>`, others sync; standardize on Next.js version convention.
12. **Parent UI primitives** — `LoadingSkeleton` / `ErrorState` exist but underused.

---

## Suggested Next Phase

### Phase 2 — Persistence & Boundary Hardening

1. Migrate avatar / photo-album / schedule-image to `createBlobStore`.
2. Finish `DomainError` across wish, diary, hospital-day, parent letter services.
3. Extract `useLogout` / `useDeleteAccount`; expand `fetchJson` to remaining Views.
4. Split OnboardingFlow & ParentSchedulePanel into `lib/` + hooks (UI markup unchanged).
5. Promote FLOWER/LEAF catalogs + DTOs into frontend-safe modules.
6. Decide fate of `companion-status` and empty API directories.
7. Optional: enforce lint rule against `any` and against importing `@/backend` from client components (types-only exceptions).

### Phase 3 — Observability & Quality

- Shared loading/empty presentational helpers (same visuals, less copy-paste).
- Contract tests for `withApiGuard` + DomainError status mapping.
- Facade adoption or deletion of `@/services` / `@/types`.

---

## Verification

- Typecheck: run `npx tsc --noEmit` after changes.
- Behavior preserved: API JSON shapes, garden/wish/auth UX, letter save flow, account wipe includes memory letters.
