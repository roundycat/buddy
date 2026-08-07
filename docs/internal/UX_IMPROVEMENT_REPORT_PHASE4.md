# UX Improvement Report — Phase 4

작성일: 2026-08-06
범위: 프론트엔드 전 표면(아이 앱 + 보호자 앱)
검증: `tsc --noEmit` 통과 · `next lint --max-warnings=0` 통과 · `next build` 성공 (34 라우트)

---

## 0. 이번 페이즈의 기준

이 앱은 입원 중인 아이가 쓴다. 그래서 폴리시의 기준을 "예쁜가"가 아니라 **"병원 시스템처럼 느껴지지 않는가"** 로 잡았다.

구체적으로 네 가지 규칙을 정하고, 모든 변경을 여기에 맞췄다.

| 규칙 | 실제 적용 방식 |
|------|----------------|
| **Warm** | 빈 화면에 회색 텍스트를 두지 않는다. 종이 톤 카드와 부드러운 펄스로 채운다 |
| **Comforting** | 에러 문구는 원인보다 안심을 먼저 말하고, 아이를 탓하지 않는다 |
| **Child-friendly** | 탭 타겟 44px 이상, 본문 14px 이상, 병상에서 읽히는 행간 |
| **Magical** | 등장은 스프링, 사라짐은 페이드. 250ms 이하로 "탁" 붙는 전환은 쓰지 않는다 |

기능·데이터 흐름·라우팅은 하나도 바꾸지 않았다. 이번 변경은 전부 표현 계층이다.

---

## 1. 진단 — 폴리시 전 상태

Phase 3까지 오면서 정원·나무·스토리북 같은 **주인공 화면은 이미 모션이 풍부**했다. 문제는 그 사이의 틈이었다.

발견된 격차:

1. **로딩** — 13개 표면이 `"불러오는 중…"` 평문 한 줄. Suspense가 끝나는 순간 레이아웃이 튀었다.
2. **에러** — 아이 화면에 공유 컴포넌트가 없어서 `<p className="text-bedi-rose">` 인라인이 6곳에 흩어져 있었다. 보호자 앱에는 `ErrorState`가 있는데 아이 앱에는 없었다.
3. **빈 상태** — 기억 타임라인은 빈 배열일 때 **아무것도 렌더링하지 않았다**. 일기·지갑·주간 정원은 한 줄 텍스트뿐.
4. **모달** — `role="dialog"` 9곳 중 **6곳이 Escape로 닫히지 않았고**, 열려 있어도 뒤 페이지가 스크롤됐다.
5. **탭 타겟** — 달력 화살표·시트 닫기·모험 액션 버튼이 30~36px. 손이 흔들리는 아이에게는 작다.
6. **포커스** — `focus-visible` 스타일이 보호자 프로필 설정 한 곳에만 있었다.
7. **태블릿** — 모든 셸이 `max-w-lg` 고정. `md:`/`lg:` 브레이크포인트가 사실상 없었다.

---

## 2. 만든 것 — 공유 UI 기반

폴리시를 화면마다 손으로 바르면 다음에 또 어긋난다. 그래서 먼저 **아이용 공유 킷**을 만들어 `ParentUi`와 대칭 구조로 맞췄다.

### `src/frontend/shared/components/ChildUi.tsx` (신규)

| Export | 역할 |
|--------|------|
| `SoftPulse` | 모든 스켈레톤의 기본 단위. 라운드 펄스 블록 |
| `SoftSkeleton` | 카드 모양 로딩. `role="status"` + `aria-busy` 포함 |
| `PageSkeleton` | 라우트 진입 로딩. 헤더 자리까지 잡아 레이아웃 점프 제거 |
| `MemoryCardSkeleton` | 기억 카드용. 꽃/잎 실루엣을 유지해 도착 시 카드가 리사이즈되지 않음 |
| `CompanionRoomSkeleton` | 홈 전용. 아바타 원 + 말풍선 형태로 "친구가 걸어 들어오는" 느낌 |
| `SoftEmptyState` | 아이콘 + 제목 + 설명 + 선택적 CTA |
| `SoftErrorState` | `role="alert"`, 로즈 톤, 선택적 재시도 |

### `src/frontend/shared/hooks/useDialogDismiss.ts` (신규)

Escape 닫기 + 배경 스크롤 잠금을 한 훅으로 묶었다. 이제 모든 다이얼로그가 같은 규칙을 따른다.

### `src/frontend/shared/lib/motion.ts` (신규)

앱 전체의 모션 언어를 한 파일로 모았다.

- `softSpring` — 등장·이동 기본값 (stiffness 220 / damping 26)
- `softStagger` + `softRise` — 자식이 하나씩 떠오르는 컨테이너
- `useSoftMotion()` — reduced-motion일 때 스태거·스프링·프레스를 **자동으로 무력화**하고 순수 페이드로 낮춤

### `src/frontend/shared/components/MotionProvider.tsx` (신규)

루트 레이아웃을 `<MotionConfig reducedMotion="user">`로 감쌌다. 스토리북 씬에만 `repeat: Infinity` 애니메이션이 15개 넘게 있었는데, 이걸 하나씩 손으로 막는 대신 **Framer 레벨에서 OS 설정을 자동 존중**하게 했다. 구름·반딧불·페이지 넘김이 전부 한 번에 커버된다.

---

## 3. Loading

평문 13곳을 전부 해당 화면의 형태를 닮은 스켈레톤으로 교체했다. 문구도 기능별로 다르게 줘서, 기다리는 동안에도 어디로 가는 중인지 알 수 있게 했다.

| 화면 | 이전 | 이후 |
|------|------|------|
| 홈 | `불러오는 중…` | `CompanionRoomSkeleton` (아바타 실루엣) |
| 감정 정원 | 평문 | `SoftSkeleton` · "정원을 여는 중" |
| 마음 나무 | 평문 | `SoftSkeleton` · "나무를 깨우는 중" |
| 스토리북 | 평문 | `SoftSkeleton` · "이야기를 펼치는 중" |
| 모험 | 평문 | `SoftSkeleton` · "모험을 준비하는 중" |
| 그림일기 | 평문 | `SoftSkeleton` · "그림일기를 펴는 중" |
| 기억 우체국 | 평문 | `SoftSkeleton` · "편지를 꺼내는 중" |
| 온보딩 | 평문 | `PageSkeleton` |
| 사진첩 | 평문 | 정사각 그리드 펄스 (실제 그리드와 동일 배치) |
| 기억 카드 (꽃/잎) | `기억을 불러오는 중…` | `MemoryCardSkeleton` |
| 전역 `loading.tsx` | 인라인 펄스 바 | `PageSkeleton` 재사용 |

모든 스켈레톤에 `role="status"` / `aria-live="polite"` / `aria-busy` 와 `sr-only` 라벨을 넣어, 스크린리더 사용자도 "멈춘 화면"이 아니라 "오는 중"으로 읽는다.

---

## 4. Error States

아이 화면의 인라인 에러 6곳을 `SoftErrorState`로 통일했다.

- `EmotionGardenView` · `WishTreeView` · `GrowthStorybookView`(2곳) · `PictureDiaryView` · `PhotoAlbumSection`

이전에는 `bg-bedi-rose/15` 톤이 화면마다 조금씩 달랐고 `role`이 없어 스크린리더가 에러 발생을 알리지 못했다. 이제 전부 `role="alert"` 로즈 카드로 통일되고, 필요하면 "다시 해볼까요" 재시도 버튼을 붙일 수 있다.

성공 알림(`notice`)도 같은 리듬으로 맞췄다 — 일기 저장 알림이 `text-xs` 초록 텍스트에서 세이지 톤 카드 + `role="status"`가 됐다.

---

## 5. Empty States

빈 화면은 "데이터 없음"이 아니라 **"아직 이야기가 시작되지 않았다"** 로 다시 썼다.

| 화면 | 이전 | 이후 |
|------|------|------|
| 기억 타임라인 | **렌더링 없음** | 🌱 "아직 첫 발자국이에요" |
| 그림일기 | 회색 한 줄 | 🖍️ "아직 빈 공책이에요" |
| 사진첩 | dashed 박스 | 📷 "아직 사진이 없어요" |
| 지갑 | 텍스트 문단 | ⭐ "아직 모은 별조각이 없어요" |
| 마음 나무 | "이렇게 시작해도 좋아요" 라벨만 | "아직 가지가 비어 있어요" + 설명 + 제안 칩 |
| 주간 정원 | "아직 이번 주 씨앗이 없어요" | "아직 비어 있어요. 오늘 마음 하나를 심으면 여기 첫 싹이 나요." |
| 스토리북 | 텍스트 링크 2개 | 떠오르는 🌱 + 알약형 CTA 버튼 2개 |

카피 원칙은 하나다. **부정형("없어요")으로 끝내지 않고, 다음 한 걸음을 알려주고 끝낸다.**

---

## 6. Accessibility

### Escape + 스크롤 잠금

`useDialogDismiss`를 6개 다이얼로그에 적용했다. 이제 9개 `role="dialog"` 전부가 Escape로 닫힌다.

- `MemoryFlowerCard` · `LeafMemoryCard` · `HangWishSheet` · `DailyPlantingModal` · `ScheduleNotifySheet` · `QuickActionMenu`
- `QuickActionMenu`에는 누락돼 있던 `aria-modal="true"`도 추가

### 포커스 링

`globals.css` base 레이어에 전역 `:focus-visible` 규칙을 넣었다 — 세이지 톤 2px 아웃라인, 오프셋 2px. `:focus`가 아니라 `:focus-visible`이라서 **꽃을 탭한 아이에게는 사각형이 뜨지 않고**, 키보드 사용자에게만 보인다. 여기에 더해 주요 CTA·아이콘 버튼에는 개별 링도 명시했다.

### 탭 타겟 44px

| 대상 | 이전 → 이후 |
|------|-------------|
| 병원 일정 / 보호자 타임라인 월 네비 | 36px → 44px |
| 알림 시트 닫기 | 36px → 44px |
| 일기 사진 떼기 | 36px → 44px |
| 스토리북 편지 굵게/기울임 | 36px → 44px |
| 마음 나무 종류·시기 칩 | 38px → 44px |
| 크레용 색 선택 | 36px → 44px 히트박스 (**시각 크기는 유지**, 안쪽 span으로 분리) |
| 붓 굵기 / 지우개 / 되돌리기 | 40px → 44px |
| 모험 액션 4종 | ~30px → 44px |

크레용은 특히 조심했다. 팔레트가 커지면 캔버스가 좁아지므로, 버튼만 44px로 키우고 색 원은 그대로 뒀다.

### 그 외

- `-webkit-tap-highlight-color: transparent` — 탭 시 파란 박스 제거
- `word-break: keep-all` — 한글이 단어 중간에서 잘리지 않게
- 모든 스켈레톤에 라이브 리전
- 사진 이미지에 `loading="lazy"` / `decoding="async"` 추가 (사진첩, 기억 카드 2종)

---

## 7. Animations & Transitions

### 감정 정원

`EmotionGardenView`가 이제 스태거 컨테이너다. 헤더 카드 → 오늘의 씨앗 → 주간 정원이 70ms 간격으로 차례로 떠오른다. 기존 CSS 성장 애니메이션(줄기·꽃봉오리·잎)은 그대로 살아 있고, 그 위에 진입 리듬만 얹었다.

### 마음 나무

`WishTreeView`도 동일한 스태거를 적용했다. 잎 드래그·`whileTap`은 유지.

### 기억 카드 (꽃 · 잎)

가장 크게 달라진 곳이다.

- 로딩이 평문에서 **실루엣 스켈레톤**으로 → 카드가 리사이즈되지 않음
- 내용 섹션(한 문장 / 그날의 모험 / 사진 / 대화의 결 / 예약 슬롯 / CTA)이 **하나씩 순서대로** 떠오름 → 기억이 펼쳐지는 느낌
- reduced-motion이면 스프링 대신 150ms 페이드로 자동 축소

### 스토리북 프리뷰

빈 상태의 🌱가 3.6초 주기로 부드럽게 떠오른다. 링크였던 진입점을 알약형 버튼(`모험 떠나기` / `그림 일기`)으로 바꿔 탭하기 쉽게 했다.

### 정적이던 화면

`MemoryTimelineView` · `PictureDiaryView` · `WalletView` · `AdventureQuestView`에 `.feature-enter`(480ms fade-up)를 넣었다. 서버 컴포넌트라 Framer를 못 쓰는 곳이라 CSS로 처리했고, reduced-motion 블록에 등록했다.

### 프레스 피드백

`.press-soft` 유틸리티(`active:scale(0.98)`, 150ms)를 만들어 정원·나무에만 있던 `whileTap` 감각을 일기·모험·나무 초안 버튼까지 확장했다. reduced-motion에서는 변형이 꺼진다.

---

## 8. Typography & Spacing

`text-[10px]`부터 `text-[17px]`까지 10가지 임의 픽셀값이 섞여 있었다. 전면 교체는 리스크가 크므로, **정본을 먼저 문서화**하고 새 컴포넌트부터 여기에 맞췄다.

`globals.css`의 유틸리티 레이어:

| 클래스 | 크기 / 행간 | 용도 |
|--------|-------------|------|
| `.type-eyebrow` | 11px / 1.45 | 섹션 위 라벨 |
| `.type-meta` | 12px / 1.5 | 날짜·보조 정보 |
| `.type-body` | 14px / 1.75 | 본문 |
| `.type-title` | 15px / 1.5 | 카드 제목 |
| `.type-display` | 20px / 1.4 | 페이지 제목 |

본문 행간을 1.75로 잡은 건 한글 가독성 때문이다. 보호자 하단 내비 라벨은 10px에서 11px로 올렸다.

---

## 9. Tablet UX

`max-w-lg`(512px) 하나로 고정돼 있어서 아이패드에서는 가운데 좁은 기둥만 보였다. 셸 전체에 `md:max-w-2xl`(672px) + `md:px-8`을 적용해 **레이아웃 구조는 그대로 두고 여백만** 늘렸다.

적용 대상: `FeaturePageShell` · `TopBrandBar` · `ParentShell`(헤더·본문) · `ParentBottomNav` · `WaitingRoom` · `MoodCalendar` · 페이지 래퍼 6개(`storybook` `diary` `post` `hospital` `today` `growth`)

`FeaturePageShell` 제목도 `md:text-2xl`로 한 단계 키우고 설명문에 `max-w-md`를 걸어 태블릿에서 한 줄이 너무 길어지지 않게 했다.

2열 그리드 같은 구조 변경은 하지 않았다. 아이가 태블릿과 폰을 오갈 때 화면 배치가 달라지면 오히려 혼란스럽기 때문이다.

---

## 10. Reduced Motion

이건 취향이 아니라 **케어 요건**이다. 치료 후 전정기관이 예민해지는 경우가 흔하다.

세 겹으로 처리했다:

1. **Framer 전역** — `MotionConfig reducedMotion="user"`가 모든 Framer 애니메이션을 자동 커버
2. **훅 레벨** — `useSoftMotion()`이 스태거·스프링·프레스를 개별 무력화
3. **CSS** — 기존 reduced-motion 블록에 누락돼 있던 `.bedi-fresh-schedule`, 신규 `.feature-enter`, `.press-soft` 추가

---

## 11. 변경 파일

**신규 (4)**

```
src/frontend/shared/components/ChildUi.tsx
src/frontend/shared/components/MotionProvider.tsx
src/frontend/shared/hooks/useDialogDismiss.ts
src/frontend/shared/lib/motion.ts
```

**수정 (25)**

```
src/app/globals.css · layout.tsx · loading.tsx · page.tsx
src/app/{garden,wish,storybook,adventure,diary,post,onboarding,hospital,today,growth}/page.tsx
src/frontend/shared/components/{FeaturePageShell,TopBrandBar}.tsx
src/frontend/features/emotion-garden/components/{EmotionGardenView,MemoryFlowerCard,DailyPlantingModal,WeekGarden}.tsx
src/frontend/features/wish-tree/components/{WishTreeView,LeafMemoryCard,HangWishSheet}.tsx
src/frontend/features/growth-storybook/components/GrowthStorybookView.tsx
src/frontend/features/picture-diary/components/{PictureDiaryView,DrawingCanvas}.tsx
src/frontend/features/memory-timeline/components/MemoryTimelineView.tsx
src/frontend/features/photo-album/components/PhotoAlbumSection.tsx
src/frontend/features/wallet/components/WalletView.tsx
src/frontend/features/adventure-quest/components/AdventureQuestView.tsx
src/frontend/features/waiting-room/components/{WaitingRoom,ScheduleNotifySheet}.tsx
src/frontend/features/hospital-day/components/HospitalScheduleView.tsx
src/frontend/features/timeline/components/MoodCalendar.tsx
src/frontend/features/parent/components/{ParentShell,ParentBottomNav,StorybookLetterCard}.tsx
src/frontend/features/parent/components/schedule/QuickActionMenu.tsx
src/frontend/features/parent/timeline/ParentTimelineView.tsx
```

번들 영향은 미미하다. 정원 158kB / 나무 158kB / 스토리북 160kB로 Phase 3 대비 실질적 변동 없음 — 공유 킷이 여러 화면에서 중복 코드를 대체했기 때문이다.

---

## 12. 남은 것

기능 변경을 동반하므로 이번 범위에서 제외했다.

| 항목 | 이유 |
|------|------|
| **포커스 트랩** | Escape와 스크롤 잠금은 넣었지만 Tab 순환 가둠은 없다. `focus-trap-react` 도입 또는 직접 구현 필요 |
| **타이포 전면 마이그레이션** | `.type-*` 정본은 정의했으나 기존 임의값 교체는 시각 회귀 테스트가 있어야 안전 |
| **태블릿 2열 레이아웃** | 여백만 늘렸다. 정원/나무를 넓은 캔버스로 재구성하려면 좌표 로직 변경이 필요 |
| **햅틱** | 씨앗 심기·잎 걸기 순간의 `navigator.vibrate` — iOS Safari 미지원이라 보류 |
| **다크 모드** | 야간 병실에서 유용하겠지만 종이 톤 팔레트 전체를 다시 설계해야 함 |
