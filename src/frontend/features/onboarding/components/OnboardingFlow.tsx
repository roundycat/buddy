"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/frontend/shared/lib/utils";
import {
  OTHER_LABEL,
  joinSelections,
  toggleValue,
} from "@/frontend/features/onboarding/lib/selections";
import {
  BIRTH_YEARS,
  CURRENT_YEAR,
  DISPOSITION_OPTIONS,
  ENERGY_OPTIONS,
  FAVORITE_HOBBY_OPTIONS,
  FOOD_OPTIONS,
  HOBBY_OPTIONS,
  INTERACTION_OPTIONS,
  MAIN_ACTIVITY_OPTIONS,
  STRENGTH_OPTIONS,
  STRESS_RELIEF_OPTIONS,
  TOTAL_STEPS,
  AVATAR_PICK_STEP,
  WEAKNESS_OPTIONS,
  type EnergyLevel,
  type InteractionStyle,
} from "@/frontend/features/onboarding/lib/onboarding-options";
import {
  buildPersonaGeneratePayload,
  type OnboardingBuildMode,
} from "@/frontend/features/onboarding/lib/onboarding-payload";
import { getOnboardingNextAction } from "@/frontend/features/onboarding/lib/onboarding-navigation";
import { buildOnboardingSummary } from "@/frontend/features/onboarding/lib/onboarding-summary";
import { fetchAvatarChoices } from "@/frontend/features/persona/lib/fetch-avatar-choices";
import { selectAvatarChoice } from "@/frontend/features/persona/lib/select-avatar";

const fieldClass =
  "h-11 w-full rounded-xl border border-bedi-slate/10 bg-white px-3.5 text-sm text-bedi-slate outline-none transition-colors placeholder:text-bedi-slate/30 focus:border-bedi-sage/50";

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="block space-y-1.5">
      <span className="text-xs font-medium text-bedi-slate/50">
        {label}
        {optional && (
          <span className="ml-1 rounded-full bg-bedi-slate/8 px-1.5 py-0.5 text-[10px] font-normal text-bedi-slate/35">
            선택
          </span>
        )}
      </span>
      {children}
    </div>
  );
}

/** Dropdown that shows ~5 rows and scrolls the rest */
function ScrollSelect({
  value,
  onChange,
  options,
  placeholder,
  formatOption,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<string | number>;
  placeholder: string;
  formatOption?: (option: string | number) => string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const labelOf = formatOption ?? ((option: string | number) => String(option));

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          fieldClass,
          "flex items-center justify-between text-left",
          !value && "text-bedi-slate/35"
        )}
      >
        <span>{value ? labelOf(value) : placeholder}</span>
        <span className="text-bedi-sage" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <ul
          className="absolute z-20 mt-1 max-h-[11.25rem] w-full overflow-y-auto rounded-xl border border-bedi-slate/10 bg-white py-1 shadow-soft"
          role="listbox"
        >
          <li>
            <button
              type="button"
              className="flex h-9 w-full items-center px-3.5 text-left text-sm text-bedi-slate/40 hover:bg-bedi-background"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {placeholder}
            </button>
          </li>
          {options.map((option) => {
            const optionValue = String(option);
            const active = value === optionValue;
            return (
              <li key={optionValue}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn(
                    "flex h-9 w-full items-center px-3.5 text-left text-sm transition-colors hover:bg-bedi-sage/10",
                    active
                      ? "bg-bedi-sage/15 font-medium text-bedi-slate"
                      : "text-bedi-slate/75"
                  )}
                  onClick={() => {
                    onChange(optionValue);
                    setOpen(false);
                  }}
                >
                  {labelOf(option)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ChipGroup({
  options,
  selected,
  onToggle,
  accent = "sage",
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  accent?: "sage" | "rose";
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={cn(
              "flex min-h-[56px] w-full items-center justify-center rounded-xl border px-2 py-2 text-center text-[11px] leading-tight font-medium transition-colors",
              active
                ? accent === "rose"
                  ? "border-bedi-rose/45 bg-bedi-rose/15 text-bedi-slate"
                  : "border-bedi-sage/50 bg-bedi-sage/15 text-bedi-slate"
                : "border-bedi-slate/10 bg-white text-bedi-slate/70 hover:border-bedi-slate/20 hover:bg-bedi-slate/[0.02]"
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function ChipGroupWithOther({
  options,
  selected,
  onChange,
  otherText,
  onOtherTextChange,
  otherPlaceholder = "직접 입력해 주세요",
  single = false,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  otherText: string;
  onOtherTextChange: (value: string) => void;
  otherPlaceholder?: string;
  single?: boolean;
}) {
  const otherSelected = selected.includes(OTHER_LABEL);

  function toggle(option: string) {
    if (single) {
      onChange(selected.includes(option) ? [] : [option]);
      return;
    }
    onChange(toggleValue(selected, option));
  }

  function toggleOther() {
    if (otherSelected) {
      onChange(selected.filter((item) => item !== OTHER_LABEL));
      return;
    }
    onChange(single ? [OTHER_LABEL] : [...selected, OTHER_LABEL]);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors",
                active
                  ? "border-bedi-sage/50 bg-bedi-sage/15 text-bedi-slate"
                  : "border-bedi-slate/10 bg-white text-bedi-slate/65 hover:border-bedi-slate/20"
              )}
            >
              {option}
            </button>
          );
        })}
        <button
          type="button"
          onClick={toggleOther}
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors",
            otherSelected
              ? "border-bedi-rose/45 bg-bedi-rose/15 text-bedi-slate"
              : "border-bedi-slate/10 bg-white text-bedi-slate/65 hover:border-bedi-slate/20"
          )}
        >
          {OTHER_LABEL}
        </button>
      </div>
      {otherSelected && (
        <input
          className={fieldClass}
          value={otherText}
          onChange={(e) => onOtherTextChange(e.target.value)}
          placeholder={otherPlaceholder}
          maxLength={40}
        />
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  if (!value?.trim()) return null;
  return (
    <div className="border-b border-bedi-slate/6 py-3 last:border-b-0">
      <p className="text-[11px] tracking-wide text-bedi-slate/40">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-bedi-slate">{value}</p>
    </div>
  );
}

/**
 * Append colloquial "이" for child-facing copy (지민 → 지민이).
 */
function formatNameWithI(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "아이";
  if (trimmed.endsWith("이")) return trimmed;
  return `${trimmed}이`;
}

type CreatePhase = "persona" | "drawing" | "finishing" | "entering";

const CREATE_PHASE_STEPS: Array<{
  id: CreatePhase;
  label: string;
}> = [
  { id: "persona", label: "마음을 읽고 있어요" },
  { id: "drawing", label: "모습을 그리고 있어요" },
  { id: "finishing", label: "만날 준비를 하고 있어요" },
];

function FriendComingProgress({
  nickname,
  phase,
}: {
  nickname: string;
  phase: CreatePhase;
}) {
  const friend = (nickname || "Beddy").trim() || "Beddy";
  const isEntering = phase === "entering";
  const activeIndex = isEntering
    ? CREATE_PHASE_STEPS.length - 1
    : Math.max(
        0,
        CREATE_PHASE_STEPS.findIndex((s) => s.id === phase)
      );
  const [displayPct, setDisplayPct] = useState(12);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const targets: Record<CreatePhase, number> = {
      persona: 28,
      drawing: 62,
      finishing: 88,
      entering: 96,
    };
    const floor = targets[phase];
    setDisplayPct((prev) => Math.max(prev, floor));

    const tick = window.setInterval(() => {
      setDisplayPct((prev) => {
        const ceiling =
          phase === "persona"
            ? 42
            : phase === "drawing"
              ? 82
              : phase === "finishing"
                ? 94
                : 98;
        if (prev >= ceiling) return prev;
        return Math.min(ceiling, prev + (phase === "drawing" ? 0.35 : 0.55));
      });
      setElapsedSec((s) => s + 1);
    }, 1000);

    return () => window.clearInterval(tick);
  }, [phase]);

  return (
    <section className="flex min-h-[320px] flex-col items-center justify-center text-center">
      <div
        className="relative flex h-20 w-20 items-center justify-center rounded-[24px] bg-bedi-sage/15"
        style={{ animation: "persona-breathe 2.4s ease-in-out infinite" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-512.png"
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 rounded-[16px] object-cover"
        />
      </div>

      <h1 className="mt-6 text-xl font-semibold text-bedi-slate">
        {friend}이(가) 오는 중이에요
      </h1>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-bedi-slate/50">
        {isEntering
          ? "이제 곧 만나요. 조금만 기다려 주세요."
          : "조금 시간이 걸려요. 진행 상황을 보여 드릴게요."}
      </p>

      <div className="mt-8 w-full max-w-xs">
        <div className="mb-2 flex items-center justify-between text-[11px] tabular-nums text-bedi-slate/40">
          <span>진행률</span>
          <span>{Math.round(displayPct)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-bedi-slate/10">
          <div
            className="h-full rounded-full bg-bedi-sage transition-[width] duration-700 ease-out"
            style={{ width: `${displayPct}%` }}
          />
        </div>
      </div>

      <ol className="mt-8 w-full max-w-xs space-y-3 text-left">
        {CREATE_PHASE_STEPS.map((stepItem, index) => {
          const done = index < activeIndex || (isEntering && index <= activeIndex);
          const active = !isEntering && index === activeIndex;
          return (
            <li
              key={stepItem.id}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                active && "bg-bedi-sage/10",
                done && !active && "opacity-55"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                  done || active
                    ? "bg-bedi-sage text-white"
                    : "bg-bedi-slate/10 text-bedi-slate/40"
                )}
              >
                {done && !active ? "✓" : index + 1}
              </span>
              <span
                className={cn(
                  "text-sm",
                  active
                    ? "font-medium text-bedi-slate"
                    : "text-bedi-slate/55"
                )}
              >
                {stepItem.label}
                {active ? "…" : ""}
              </span>
            </li>
          );
        })}
      </ol>

      {elapsedSec >= 12 && (
        <p className="mt-6 text-xs text-bedi-slate/40">
          그림 그리는 데 조금 더 걸릴 수 있어요.
        </p>
      )}
    </section>
  );
}

/**
 * Onboarding: my personality → mirror or custom secret-friend character.
 */
export function OnboardingFlow({
  accountName = "",
}: {
  accountName?: string;
}) {
  const [step, setStep] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  // —— 나의 기본 신상 ——
  const [selfName, setSelfName] = useState(accountName.trim());
  const [selfAgeOrBirthYear, setSelfAgeOrBirthYear] = useState("");
  const accountNameI = formatNameWithI(accountName);

  // —— 나의 성격 ——
  const [selfDispositions, setSelfDispositions] = useState<string[]>([]);
  const [selfStrengths, setSelfStrengths] = useState<string[]>([]);
  const [selfWeaknesses, setSelfWeaknesses] = useState<string[]>([]);

  // —— 나의 일상/취향 ——
  const [selfStressRelief, setSelfStressRelief] = useState<string[]>([]);
  const [selfStressOther, setSelfStressOther] = useState("");
  const [selfHobbies, setSelfHobbies] = useState<string[]>([]);
  const [selfHobbiesOther, setSelfHobbiesOther] = useState("");
  const [selfFavoriteHobby, setSelfFavoriteHobby] = useState<string[]>([]);
  const [selfFavoriteHobbyOther, setSelfFavoriteHobbyOther] = useState("");
  const [selfMainActivity, setSelfMainActivity] = useState<string[]>([]);
  const [selfMainActivityOther, setSelfMainActivityOther] = useState("");
  const [selfFavoriteFood, setSelfFavoriteFood] = useState<string[]>([]);
  const [selfFavoriteFoodOther, setSelfFavoriteFoodOther] = useState("");

  // —— 페르소나 방식 ——
  const [buildMode, setBuildMode] = useState<OnboardingBuildMode | null>(null);

  // —— Beddy ——
  const [nickname, setNickname] = useState("");
  const [charDispositions, setCharDispositions] = useState<string[]>([]);
  const [charStrengths, setCharStrengths] = useState<string[]>([]);
  const [charWeaknesses, setCharWeaknesses] = useState<string[]>([]);

  const [stressRelief, setStressRelief] = useState<string[]>([]);
  const [stressOther, setStressOther] = useState("");
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [hobbiesOther, setHobbiesOther] = useState("");
  const [favoriteHobby, setFavoriteHobby] = useState<string[]>([]);
  const [favoriteHobbyOther, setFavoriteHobbyOther] = useState("");
  const [mainActivity, setMainActivity] = useState<string[]>([]);
  const [mainActivityOther, setMainActivityOther] = useState("");
  const [favoriteFood, setFavoriteFood] = useState<string[]>([]);
  const [favoriteFoodOther, setFavoriteFoodOther] = useState("");

  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [interaction, setInteraction] = useState<InteractionStyle | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [createPhase, setCreatePhase] = useState<CreatePhase | null>(null);
  const [avatarChoices, setAvatarChoices] = useState<
    Array<{ id: string; url: string }>
  >([]);
  const [pickedAvatarId, setPickedAvatarId] = useState<string | null>(null);

  function goTo(next: number) {
    setError(null);
    setStep(next);
    setAnimKey((k) => k + 1);
  }

  function applyMirrorPersonality() {
    setCharDispositions([...selfDispositions]);
    setCharStrengths([...selfStrengths]);
    setCharWeaknesses([...selfWeaknesses]);
    setStressRelief([...selfStressRelief]);
    setStressOther(selfStressOther);
    setHobbies([...selfHobbies]);
    setHobbiesOther(selfHobbiesOther);
    setFavoriteHobby([...selfFavoriteHobby]);
    setFavoriteHobbyOther(selfFavoriteHobbyOther);
    setMainActivity([...selfMainActivity]);
    setMainActivityOther(selfMainActivityOther);
    setFavoriteFood([...selfFavoriteFood]);
    setFavoriteFoodOther(selfFavoriteFoodOther);
  }

  async function submit() {
    if (!selfName.trim() || !nickname.trim() || !energy || !interaction || !buildMode)
      return;

    setPending(true);
    setCreatePhase("persona");
    setError(null);
    const payload = buildPersonaGeneratePayload({
      buildMode,
      selfName,
      selfAgeOrBirthYear,
      selfRegion: "",
      selfDispositions,
      selfStrengths,
      selfWeaknesses,
      selfStressRelief: { values: selfStressRelief, other: selfStressOther },
      selfHobbies: { values: selfHobbies, other: selfHobbiesOther },
      selfFavoriteHobby: {
        values: selfFavoriteHobby,
        other: selfFavoriteHobbyOther,
      },
      selfMainActivity: { values: selfMainActivity, other: selfMainActivityOther },
      selfFavoriteFood: { values: selfFavoriteFood, other: selfFavoriteFoodOther },
      nickname,
      ageOrBirthYear: "",
      region: "",
      charDispositions,
      charStrengths,
      charWeaknesses,
      stressRelief: { values: stressRelief, other: stressOther },
      hobbies: { values: hobbies, other: hobbiesOther },
      favoriteHobby: { values: favoriteHobby, other: favoriteHobbyOther },
      mainActivity: { values: mainActivity, other: mainActivityOther },
      favoriteFood: { values: favoriteFood, other: favoriteFoodOther },
      energy,
      interaction,
    });

    try {
      const res = await fetch("/api/persona/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "페르소나 생성에 실패했습니다.");
      }

      // Persona saved — now draw 2 candidates in parallel (CloudFront-safe).
      setCreatePhase("drawing");
      const { choices, error: drawError } = await fetchAvatarChoices();

      if (choices.length > 0) {
        setCreatePhase("finishing");
        setAvatarChoices(choices);
        setPickedAvatarId(choices[0]!.id);
        goTo(AVATAR_PICK_STEP);
        return;
      }

      throw new Error(
        drawError ??
          "그림을 그리지 못했어요. 대기실에서 다시 그려 볼 수 있어요."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "페르소나 생성에 실패했습니다."
      );
    } finally {
      setPending(false);
      setCreatePhase(null);
    }
  }

  async function confirmAvatarPick() {
    if (!pickedAvatarId) {
      setError("마음에 드는 그림을 골라 주세요.");
      return;
    }

    setPending(true);
    setCreatePhase("entering");
    setError(null);
    try {
      await selectAvatarChoice(pickedAvatarId);
      window.location.assign("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "선택한 그림을 저장하지 못했어요."
      );
      setPending(false);
      setCreatePhase(null);
    }
  }

  async function redrawAvatars() {
    setPending(true);
    setCreatePhase("drawing");
    setError(null);
    try {
      const { choices, error: drawError } = await fetchAvatarChoices();

      if (choices.length === 0) {
        throw new Error(
          drawError ?? "그림을 다시 그리지 못했어요. 다시 시도해 주세요."
        );
      }

      setAvatarChoices(choices);
      setPickedAvatarId(choices[0]!.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "그림을 다시 그리지 못했어요."
      );
    } finally {
      setPending(false);
      setCreatePhase(null);
    }
  }

  function handleNext() {
    if (step === AVATAR_PICK_STEP) {
      void confirmAvatarPick();
      return;
    }

    const action = getOnboardingNextAction({
      step,
      selfName,
      buildMode,
      nickname,
      energy,
      interaction,
    });

    if (action.type === "error") {
      setError(action.message);
      return;
    }
    if (action.type === "mirror-and-go") {
      applyMirrorPersonality();
      goTo(action.step);
      return;
    }
    if (action.type === "go") {
      goTo(action.step);
      return;
    }
    void submit();
  }

  const {
    energyLabel,
    interactionLabel,
    modeLabel,
    selfDispositionSummary,
    selfStrengthSummary,
    selfWeaknessSummary,
    charDispositionSummary,
    charStrengthSummary,
    charWeaknessSummary,
    selfBirthSummary,
    selfStressSummary,
    selfHobbySummary,
    selfFavoriteHobbySummary,
    selfMainActivitySummary,
    selfFoodSummary,
    stressSummary,
    hobbySummary,
    favoriteHobbySummary,
    mainActivitySummary,
    foodSummary,
  } = buildOnboardingSummary({
    currentYear: CURRENT_YEAR,
    energy,
    interaction,
    buildMode,
    selfAgeOrBirthYear,
    ageOrBirthYear: "",
    selfDispositions,
    selfStrengths,
    selfWeaknesses,
    charDispositions,
    charStrengths,
    charWeaknesses,
    selfStress: { values: selfStressRelief, other: selfStressOther },
    selfHobbies: { values: selfHobbies, other: selfHobbiesOther },
    selfFavoriteHobby: {
      values: selfFavoriteHobby,
      other: selfFavoriteHobbyOther,
    },
    selfMainActivity: { values: selfMainActivity, other: selfMainActivityOther },
    selfFood: { values: selfFavoriteFood, other: selfFavoriteFoodOther },
    stress: { values: stressRelief, other: stressOther },
    hobbies: { values: hobbies, other: hobbiesOther },
    favoriteHobby: { values: favoriteHobby, other: favoriteHobbyOther },
    mainActivity: { values: mainActivity, other: mainActivityOther },
    food: { values: favoriteFood, other: favoriteFoodOther },
    energyOptions: ENERGY_OPTIONS,
    interactionOptions: INTERACTION_OPTIONS,
  });

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-5 py-10">
      {!createPhase && (
        <>
          <header className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon-512.png"
              alt=""
              width={56}
              height={56}
              className="mx-auto h-14 w-14 rounded-[16px] object-cover"
            />
            <p className="mt-3 font-display text-2xl font-semibold tracking-tight text-bedi-slate">
              Beddy
            </p>
            <p className="mt-2 text-sm text-bedi-slate/45">
              나의 신상·성격·취향과, 퇴원까지 함께할 Beddy를 만들어요
            </p>
          </header>

          <div className="mt-8 h-1 overflow-hidden rounded-full bg-bedi-slate/10">
            <div
              className="h-full rounded-full bg-bedi-sage transition-all duration-500 ease-out"
              style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-right text-[11px] tabular-nums text-bedi-slate/35">
            {step + 1} / {TOTAL_STEPS}
          </p>
        </>
      )}

      <div key={animKey} className="onboarding-fade mt-8 min-h-[320px]">
        {createPhase ? (
          <FriendComingProgress nickname={nickname} phase={createPhase} />
        ) : (
          <>
        {step === 0 && (
          <section className="space-y-5">
            <div>
              <h1 className="text-xl font-semibold text-bedi-slate">
                나의 기본 정보
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-bedi-slate/50">
                먼저 {accountNameI}의 이름과 나이 등 기본 신상을 알려 주세요.
                <br />
                Beddy가 나를 부를 때 쓰여요.
              </p>
            </div>
            <Field label="이름 또는 닉네임">
              <input
                className={fieldClass}
                value={selfName}
                onChange={(e) => setSelfName(e.target.value)}
                placeholder="예: 지민"
                maxLength={20}
                autoFocus
              />
            </Field>
            <Field label="출생 연도" optional>
              <div className="space-y-2">
                <ScrollSelect
                  value={selfAgeOrBirthYear}
                  onChange={setSelfAgeOrBirthYear}
                  options={BIRTH_YEARS}
                  placeholder="연도를 선택하세요"
                  formatOption={(year) => `${year}년`}
                />
                {selfAgeOrBirthYear && (
                  <p className="rounded-lg bg-bedi-sage/10 px-3 py-2 text-sm text-bedi-slate/70">
                    선택한 연도:{" "}
                    <span className="font-medium text-bedi-slate">
                      {selfAgeOrBirthYear}년
                    </span>
                    <span className="text-bedi-slate/40">
                      {" "}
                      · 만 {CURRENT_YEAR - Number(selfAgeOrBirthYear)}세
                    </span>
                  </p>
                )}
              </div>
            </Field>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-5">
            <div>
              <h1 className="text-xl font-semibold text-bedi-slate">
                나의 성격
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-bedi-slate/50">
                나의 성향과 장단점을 알려 주세요. 친구를 나와 똑같이 만들지도,
                다르게 만들지도 할 수 있어요.
              </p>
            </div>
            <Field label="나의 성향" optional>
              <ChipGroup
                options={DISPOSITION_OPTIONS}
                selected={selfDispositions}
                onToggle={(value) =>
                  setSelfDispositions((prev) => toggleValue(prev, value))
                }
              />
            </Field>
            <Field label="나의 성격 장점" optional>
              <ChipGroup
                options={STRENGTH_OPTIONS}
                selected={selfStrengths}
                onToggle={(value) =>
                  setSelfStrengths((prev) => toggleValue(prev, value))
                }
              />
            </Field>
            <Field label="나의 성격 단점" optional>
              <ChipGroup
                options={WEAKNESS_OPTIONS}
                selected={selfWeaknesses}
                onToggle={(value) =>
                  setSelfWeaknesses((prev) => toggleValue(prev, value))
                }
                accent="rose"
              />
            </Field>
          </section>
        )}


        {step === 2 && (
          <section className="space-y-4">
            <div>
              <h1 className="text-xl font-semibold text-bedi-slate">
                나의 일상과 취향
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-bedi-slate/50">
                {formatNameWithI(selfName)}의 취미와 취향을 알려 주세요.
              </p>
            </div>
            <Field label="스트레스 해소법" optional>
              <ChipGroupWithOther
                options={STRESS_RELIEF_OPTIONS}
                selected={selfStressRelief}
                onChange={setSelfStressRelief}
                otherText={selfStressOther}
                onOtherTextChange={setSelfStressOther}
                otherPlaceholder="다른 해소법을 적어 주세요"
              />
            </Field>
            <Field label="취미 및 관심사" optional>
              <ChipGroupWithOther
                options={HOBBY_OPTIONS}
                selected={selfHobbies}
                onChange={setSelfHobbies}
                otherText={selfHobbiesOther}
                onOtherTextChange={setSelfHobbiesOther}
                otherPlaceholder="다른 취미/관심사를 적어 주세요"
              />
            </Field>
            <Field label="요즘 좋아하는 취미" optional>
              <ChipGroupWithOther
                options={FAVORITE_HOBBY_OPTIONS}
                selected={selfFavoriteHobby}
                onChange={setSelfFavoriteHobby}
                otherText={selfFavoriteHobbyOther}
                onOtherTextChange={setSelfFavoriteHobbyOther}
                otherPlaceholder="요즘 제일 좋아하는 걸 적어 주세요"
              />
            </Field>
            <Field label="주로 하는 일" optional>
              <ChipGroupWithOther
                options={MAIN_ACTIVITY_OPTIONS}
                selected={selfMainActivity}
                onChange={setSelfMainActivity}
                otherText={selfMainActivityOther}
                onOtherTextChange={setSelfMainActivityOther}
                otherPlaceholder="주로 하는 일을 적어 주세요"
              />
            </Field>
            <Field label="좋아하는 음식이나 취향" optional>
              <ChipGroupWithOther
                options={FOOD_OPTIONS}
                selected={selfFavoriteFood}
                onChange={setSelfFavoriteFood}
                otherText={selfFavoriteFoodOther}
                onOtherTextChange={setSelfFavoriteFoodOther}
                otherPlaceholder="좋아하는 음식/취향을 적어 주세요"
              />
            </Field>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-5">
            <div>
              <h1 className="text-xl font-semibold text-bedi-slate">
                Beddy는 어떻게 만들까요?
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-bedi-slate/50">
                나와 같은 페르소나를 원하거나, 나와 다른 친구를 직접 설정할 수
                있어요.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setBuildMode("mirror")}
              className={cn(
                "w-full rounded-2xl border px-4 py-4 text-left transition-colors",
                buildMode === "mirror"
                  ? "border-bedi-sage/50 bg-bedi-sage/10"
                  : "border-bedi-slate/10 bg-white hover:border-bedi-slate/20"
              )}
            >
              <span className="block text-sm font-medium text-bedi-slate">
                나와 똑같이 만들기
              </span>
              <span className="mt-1.5 block text-xs leading-relaxed text-bedi-slate/50">
                방금 적은 나의 성향·일상·취향을 그대로 가진 Beddy를
                만들어요.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setBuildMode("custom")}
              className={cn(
                "w-full rounded-2xl border px-4 py-4 text-left transition-colors",
                buildMode === "custom"
                  ? "border-bedi-rose/45 bg-bedi-rose/10"
                  : "border-bedi-slate/10 bg-white hover:border-bedi-slate/20"
              )}
            >
              <span className="block text-sm font-medium text-bedi-slate">
                직접 설정하기
              </span>
              <span className="mt-1.5 block text-xs leading-relaxed text-bedi-slate/50">
                나와 반대거나 다른 성격의 Beddy를 따로 골라요.
              </span>
            </button>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-5">
            <div>
              <h1 className="text-xl font-semibold text-bedi-slate">
                {buildMode === "mirror"
                  ? "나와 닮은 친구"
                  : "친구의 성격 설정"}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-bedi-slate/50">
                {buildMode === "mirror"
                  ? "이름은 정해 주세요. 성격은 나의 것이 아니라 나와 같이 적용됩니다."
                  : "Beddy만의 성향·장단점을 골라 주세요."}
              </p>
            </div>

            <Field label="친구의 이름">
              <input
                className={fieldClass}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="예: 별이, 코코, 민수"
                maxLength={20}
                autoFocus
              />
            </Field>

            {buildMode === "mirror" ? (
              <div className="rounded-2xl border border-bedi-sage/25 bg-bedi-sage/10 px-4 py-3.5">
                <p className="text-[11px] tracking-wide text-bedi-sage">
                  적용될 나의 성격
                </p>
                <p className="mt-2 text-sm leading-relaxed text-bedi-slate/75">
                  {[
                    selfDispositionSummary && `성향: ${selfDispositionSummary}`,
                    selfStrengthSummary && `장점: ${selfStrengthSummary}`,
                    selfWeaknessSummary && `단점: ${selfWeaknessSummary}`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "선택한 나의 성격이 그대로 들어갑니다."}
                </p>
              </div>
            ) : (
              <>
                <Field label="친구의 성향" optional>
                  <ChipGroup
                    options={DISPOSITION_OPTIONS}
                    selected={charDispositions}
                    onToggle={(value) =>
                      setCharDispositions((prev) => toggleValue(prev, value))
                    }
                  />
                </Field>
                <Field label="친구의 성격 장점" optional>
                  <ChipGroup
                    options={STRENGTH_OPTIONS}
                    selected={charStrengths}
                    onToggle={(value) =>
                      setCharStrengths((prev) => toggleValue(prev, value))
                    }
                  />
                </Field>
                <Field label="친구의 성격 단점" optional>
                  <ChipGroup
                    options={WEAKNESS_OPTIONS}
                    selected={charWeaknesses}
                    onToggle={(value) =>
                      setCharWeaknesses((prev) => toggleValue(prev, value))
                    }
                    accent="rose"
                  />
                </Field>
              </>
            )}
          </section>
        )}

        {step === 5 && (
          <section className="space-y-4">
            <div>
              <h1 className="text-xl font-semibold text-bedi-slate">
                {buildMode === "mirror"
                  ? "나와 같은 일상·취향"
                  : "친구의 일상과 취향"}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-bedi-slate/50">
                {buildMode === "mirror"
                  ? "취미와 취향도 나의 것과 같게 적용됩니다."
                  : "Beddy가 좋아하는 것들로 채워 주세요."}
              </p>
            </div>
            {buildMode === "mirror" ? (
              <div className="rounded-2xl border border-bedi-sage/25 bg-bedi-sage/10 px-4 py-3.5">
                <p className="text-[11px] tracking-wide text-bedi-sage">
                  적용될 나의 일상·취향
                </p>
                <p className="mt-2 text-sm leading-relaxed text-bedi-slate/75">
                  {[
                    selfStressSummary && `스트레스 해소: ${selfStressSummary}`,
                    selfHobbySummary && `취미: ${selfHobbySummary}`,
                    selfFavoriteHobbySummary &&
                      `요즘 취미: ${selfFavoriteHobbySummary}`,
                    selfMainActivitySummary &&
                      `주로 하는 일: ${selfMainActivitySummary}`,
                    selfFoodSummary && `음식/취향: ${selfFoodSummary}`,
                  ]
                    .filter(Boolean)
                    .join(" · ") ||
                    "선택한 나의 일상·취향이 그대로 들어갑니다."}
                </p>
              </div>
            ) : (
              <>
                <Field label="스트레스 해소법" optional>
                  <ChipGroupWithOther
                    options={STRESS_RELIEF_OPTIONS}
                    selected={stressRelief}
                    onChange={setStressRelief}
                    otherText={stressOther}
                    onOtherTextChange={setStressOther}
                    otherPlaceholder="다른 해소법을 적어 주세요"
                  />
                </Field>
                <Field label="취미 및 관심사" optional>
                  <ChipGroupWithOther
                    options={HOBBY_OPTIONS}
                    selected={hobbies}
                    onChange={setHobbies}
                    otherText={hobbiesOther}
                    onOtherTextChange={setHobbiesOther}
                    otherPlaceholder="다른 취미/관심사를 적어 주세요"
                  />
                </Field>
                <Field label="요즘 좋아하는 취미" optional>
                  <ChipGroupWithOther
                    options={FAVORITE_HOBBY_OPTIONS}
                    selected={favoriteHobby}
                    onChange={setFavoriteHobby}
                    otherText={favoriteHobbyOther}
                    onOtherTextChange={setFavoriteHobbyOther}
                    otherPlaceholder="요즘 제일 좋아하는 걸 적어 주세요"
                  />
                </Field>
                <Field label="주로 하는 일" optional>
                  <ChipGroupWithOther
                    options={MAIN_ACTIVITY_OPTIONS}
                    selected={mainActivity}
                    onChange={setMainActivity}
                    otherText={mainActivityOther}
                    onOtherTextChange={setMainActivityOther}
                    otherPlaceholder="주로 하는 일을 적어 주세요"
                  />
                </Field>
                <Field label="좋아하는 음식이나 취향" optional>
                  <ChipGroupWithOther
                    options={FOOD_OPTIONS}
                    selected={favoriteFood}
                    onChange={setFavoriteFood}
                    otherText={favoriteFoodOther}
                    onOtherTextChange={setFavoriteFoodOther}
                    otherPlaceholder="좋아하는 음식/취향을 적어 주세요"
                  />
                </Field>
              </>
            )}
          </section>
        )}

        {step === 6 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-xl font-semibold text-bedi-slate">
                친구가 말하는 방식
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-bedi-slate/50">
                컨디션과 말투를 고르면, Beddy의 대화 느낌이 정해져요.
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-bedi-slate/50">
                컨디션
              </p>
              <div className="grid grid-cols-3 gap-2">
                {ENERGY_OPTIONS.map((option) => {
                  const active = energy === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setEnergy(option.id)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                        active
                          ? "border-bedi-sage/50 bg-bedi-sage/15 text-bedi-slate"
                          : "border-bedi-slate/10 bg-white text-bedi-slate/70 hover:border-bedi-slate/20"
                      )}
                    >
                      <span className="block text-sm font-medium">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-bedi-slate/40">
                        {option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-bedi-slate/50">
                친구가 어떻게 말해주면 좋을까요?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {INTERACTION_OPTIONS.map((option) => {
                  const active = interaction === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setInteraction(option.id)}
                      className={cn(
                        "w-full min-h-[92px] rounded-xl border px-3 py-3 text-left transition-colors",
                        active
                          ? "border-bedi-rose/45 bg-bedi-rose/10 text-bedi-slate"
                          : "border-bedi-slate/10 bg-white text-bedi-slate/70 hover:border-bedi-slate/20"
                      )}
                    >
                      <span className="block text-[13px] font-semibold">
                        {option.label}
                      </span>
                      <span className="mt-1.5 block text-[11px] leading-snug text-bedi-slate/45">
                        {option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {step === 7 && (
          <section className="space-y-5">
            <div>
              <h1 className="text-xl font-semibold text-bedi-slate">
                이 친구와 함께할까요?
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-bedi-slate/50">
                나와 친구를 한 번 더 살펴본 뒤, 불러와 주세요.
              </p>
            </div>

            <div className="rounded-2xl border border-bedi-slate/8 bg-white/90 px-4 pb-2 pt-4 shadow-softer">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <p className="text-[11px] tracking-wide text-bedi-slate/40">
                  나
                </p>
                <p className="text-[11px] text-bedi-slate/30">사용자 정보</p>
              </div>
              <p className="mb-2 text-base font-medium text-bedi-slate">
                {selfName || "이름 없음"}
              </p>
              <SummaryRow label="출생 연도" value={selfBirthSummary} />
              <SummaryRow label="성향" value={selfDispositionSummary} />
              <SummaryRow label="장점" value={selfStrengthSummary} />
              <SummaryRow label="단점" value={selfWeaknessSummary} />
              <SummaryRow label="스트레스 해소" value={selfStressSummary} />
              <SummaryRow label="취미" value={selfHobbySummary} />
              <SummaryRow label="요즘 취미" value={selfFavoriteHobbySummary} />
              <SummaryRow label="주로 하는 일" value={selfMainActivitySummary} />
              <SummaryRow label="음식/취향" value={selfFoodSummary} />
            </div>

            <div className="rounded-2xl border border-bedi-sage/25 bg-bedi-sage/5 px-4 pb-2 pt-4 shadow-softer">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <p className="text-[11px] tracking-wide text-bedi-sage">
                  Beddy
                </p>
                <p className="text-[11px] text-bedi-slate/35">{modeLabel}</p>
              </div>
              <p className="mb-2 text-base font-medium text-bedi-slate">
                {nickname || "이름 없음"}
              </p>
              <SummaryRow label="성향" value={charDispositionSummary} />
              <SummaryRow label="장점" value={charStrengthSummary} />
              <SummaryRow label="단점" value={charWeaknessSummary} />
              <SummaryRow label="스트레스 해소" value={stressSummary} />
              <SummaryRow label="취미" value={hobbySummary} />
              <SummaryRow label="요즘 취미" value={favoriteHobbySummary} />
              <SummaryRow label="주로 하는 일" value={mainActivitySummary} />
              <SummaryRow label="음식/취향" value={foodSummary} />
              <SummaryRow label="컨디션" value={energyLabel} />
              <SummaryRow label="말하는 방식" value={interactionLabel} />
            </div>
          </section>
        )}

        {step === AVATAR_PICK_STEP && (
          <section className="space-y-5">
            <div>
              <h1 className="text-xl font-semibold text-bedi-slate">
                어떤 모습이 더 마음에 들어요?
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-bedi-slate/50">
                친구가 찾아왔어요! 퇴원까지 함께할 친구를 골라주세요!
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {avatarChoices.map((choice, index) => {
                const selected = pickedAvatarId === choice.id;
                return (
                  <button
                    key={`${choice.id}-${choice.url}`}
                    type="button"
                    onClick={() => {
                      setPickedAvatarId(choice.id);
                      setError(null);
                    }}
                    className={cn(
                      "flex flex-col items-center rounded-2xl border p-3 transition-all",
                      selected
                        ? "border-bedi-sage ring-2 ring-bedi-sage/35"
                        : "border-bedi-slate/10 hover:border-bedi-sage/40"
                    )}
                  >
                    <div
                      className="aspect-square w-full overflow-hidden rounded-xl"
                      style={{
                        backgroundImage:
                          "linear-gradient(45deg, #ece8e1 25%, transparent 25%), linear-gradient(-45deg, #ece8e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ece8e1 75%), linear-gradient(-45deg, transparent 75%, #ece8e1 75%)",
                        backgroundSize: "16px 16px",
                        backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
                        backgroundColor: "#f7f4ef",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={choice.url}
                        alt={`${nickname || "Beddy"} 후보 ${index + 1}`}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <span className="mt-2 text-xs font-medium text-bedi-slate/60">
                      {selected ? "이 친구로" : `후보 ${index + 1}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
          </>
        )}
      </div>

      {error && !createPhase && (
        <p className="mt-4 rounded-lg bg-bedi-rose/15 px-3 py-2 text-sm text-bedi-slate/80">
          {error}
        </p>
      )}

      {!createPhase && (
      <div className="mt-8 flex gap-3 pb-4">
        {step > 0 && step !== AVATAR_PICK_STEP && (
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            disabled={pending}
            className="h-12 flex-1 rounded-xl border border-bedi-slate/10 text-sm text-bedi-slate/65 transition-colors hover:bg-white disabled:opacity-50"
          >
            {step === 7 ? "수정하기" : "이전"}
          </button>
        )}
        {step === AVATAR_PICK_STEP && (
          <button
            type="button"
            onClick={() => void redrawAvatars()}
            disabled={pending}
            className="h-12 flex-1 rounded-xl border border-bedi-slate/10 text-sm text-bedi-slate/65 transition-colors hover:bg-white disabled:opacity-50"
          >
            다시 그리기
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          disabled={pending || (step === AVATAR_PICK_STEP && !pickedAvatarId)}
          className="h-12 flex-[1.5] rounded-xl bg-bedi-slate text-sm font-medium text-white transition-colors hover:bg-bedi-slate/90 disabled:opacity-50"
        >
          {pending
            ? step === AVATAR_PICK_STEP
              ? "친구가 다가오는 중…"
              : "친구가 오는 중…"
            : step === AVATAR_PICK_STEP
              ? "이 친구와 만나기"
              : step === 7
                ? "친구 불러오기"
                : step === 6
                  ? "요약 보기"
                  : "다음"}
        </button>
      </div>
      )}
    </div>
  );
}
