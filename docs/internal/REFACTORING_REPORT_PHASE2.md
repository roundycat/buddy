# Phase 2 — Persistence & Boundary Hardening

**Date:** 2026-08-06  
**Follows:** [Phase 1 report](./REFACTORING_REPORT_PHASE1.md)

## Summary

Phase 2 migrated legacy binary stores onto `createBlobStore` (legacy S3 keys preserved), expanded `DomainError` across wish/diary/hospital/letter, extracted shared client auth + schedule API helpers, wired them into real UI without redesign, and removed empty/orphan surfaces.

---

## Completed

### 1. Blob-store migration (keys preserved)

| Store | Prefix / layout |
|-------|-----------------|
| `avatar.store` | `avatars/{user}.png`, `avatars/{user}__c{n}.png` |
| `photo-album.store` | `photos/{userId}/{photoId}` (+ meta map-store) |
| `schedule-image.store` | `schedule-images/{itemId}.png` |

`createBlobStore` now supports optional `s3Key` / `localFileName` / `localDirEnv` and `readWithType`. Photo clear also removes blobs.

### 2. DomainError expansion

- wish-tree, picture-diary, storybook-parent-letter, hospital-day services
- image-upload asserts throw `DomainError`
- parent schedule + storybook-letter routes let DomainError bubble (no forced 400 rewrap)

### 3. Client hooks / API lib

- `useAuthActions` → TopBrandBar, ParentLogoutButton, StartSplash, DevJumpButtons
- `parent/lib/schedule-api.ts` → ParentSchedulePanel (all CRUD fetch paths)

### 4. Orphan cleanup

- Removed empty API dirs: `dev/garden-clock`, `dev/mission-agent`, `garden/visitor`, `persona/setup`
- Deleted unused `frontend/guardian/types.ts`
- Marked `companion-status.service` as `@deprecated` (no route/UI)

---

## Files touched (high level)

**Core:** `blob-store.ts`, avatar/photo/schedule-image stores  
**Domain:** wish/diary/letter/hospital services, image-upload, schedule routes  
**Frontend:** `useAuthActions`, `schedule-api`, ParentSchedulePanel, TopBrandBar, ParentLogoutButton, StartSplash, DevJumpButtons  
**Removed:** empty API folders, guardian/types.ts  

---

## Technical debt remaining (→ Phase 3)

1. Split OnboardingFlow / WaitingRoom / GrowthStorybookView mutation logic into libs (UI unchanged)
2. Absorb or delete `companion-status` (wire signals into parent home or remove)
3. Move FLOWER/LEAF catalogs + DTOs out of `@/backend` imports in client components
4. Contract tests for DomainError → HTTP status mapping
5. Optional ESLint boundary: no `@/backend` imports from `"use client"` except types packages
6. Parent `LoadingSkeleton` / `ErrorState` adoption

---

## Verification

- `npx tsc --noEmit` should pass after Phase 2.
- Existing avatar/photo/schedule S3 objects remain readable (legacy key builders).
- Parent schedule CRUD and auth logout/delete behavior preserved.
