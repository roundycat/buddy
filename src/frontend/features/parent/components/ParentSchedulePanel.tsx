"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp } from "lucide-react";
import { ParentCard } from "@/frontend/features/parent/components/ParentUi";
import { EmptyScheduleState } from "@/frontend/features/parent/components/schedule/EmptyScheduleState";
import { FavoriteScheduleList } from "@/frontend/features/parent/components/schedule/FavoriteScheduleList";
import { QuickActionMenu } from "@/frontend/features/parent/components/schedule/QuickActionMenu";
import { ReminderSettings } from "@/frontend/features/parent/components/schedule/ReminderSettings";
import { RepeatSelector } from "@/frontend/features/parent/components/schedule/RepeatSelector";
import { ScheduleCard } from "@/frontend/features/parent/components/schedule/ScheduleCard";
import { ScheduleTemplateSelector } from "@/frontend/features/parent/components/schedule/ScheduleTemplateSelector";
import {
  QUICK_TIMES,
  getScheduleTemplate,
  repeatLabelFor,
  type RepeatOptionId,
  type ScheduleTemplate,
  type ScheduleTemplateId,
} from "@/frontend/features/parent/lib/schedule-templates";
import { cn } from "@/frontend/shared/lib/utils";

type ScheduleItem = {
  id: string;
  type: string;
  title: string;
  time?: string;
  explanation?: string;
  done?: boolean;
  skipped?: boolean;
  dateKey: string;
  templateId?: string;
  colorTag?: string;
  repeatLabel?: string;
  reminderEnabled?: boolean;
  reminderMinutes?: number | null;
};

const FAV_KEY = "bedi-parent-schedule-favorites";

function todayDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadFavorites(): ScheduleTemplateId[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return ["blood", "medication", "rehab"];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return ["blood", "medication", "rehab"];
    return parsed.filter(
      (id): id is ScheduleTemplateId => typeof id === "string"
    );
  } catch {
    return ["blood", "medication", "rehab"];
  }
}

/**
 * Parent schedule manager — template-first, low-typing add flow.
 */
export function ParentSchedulePanel() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [linked, setLinked] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveredMsg, setDeliveredMsg] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [actionItem, setActionItem] = useState<ScheduleItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [favorites, setFavorites] = useState<ScheduleTemplateId[]>([]);
  const [templateId, setTemplateId] = useState<ScheduleTemplateId | null>(null);
  const [type, setType] = useState<"exam" | "treatment">("exam");
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("09:00");
  const [note, setNote] = useState("");
  const [colorTag, setColorTag] = useState("#A8C5E8");
  const [repeatRule, setRepeatRule] = useState<RepeatOptionId>("once");
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(10);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [dateKey, setDateKey] = useState(todayDateKey);

  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  const persistFavorites = useCallback((next: ScheduleTemplateId[]) => {
    setFavorites(next);
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/parent/schedule?date=${encodeURIComponent(dateKey)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "일정을 불러오지 못했어요.");
      setLinked(Boolean(data.linked));
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "일정을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [dateKey]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyTemplate(template: ScheduleTemplate) {
    setTemplateId(template.id);
    setType(template.type);
    setColorTag(template.colorTag);
    setComposerOpen(true);
    if (template.id === "custom") {
      setTitle("");
      setNote("");
    } else {
      setTitle(template.title);
      setNote(template.noteHint ?? "");
    }
  }

  function toggleFavorite(id: ScheduleTemplateId) {
    if (id === "custom") return;
    const next = favorites.includes(id)
      ? favorites.filter((f) => f !== id)
      : [...favorites, id];
    persistFavorites(next);
  }

  function resetComposer() {
    setTemplateId(null);
    setTitle("");
    setNote("");
    setTime("09:00");
    setRepeatRule("once");
    setReminderEnabled(false);
    setReminderMinutes(10);
    setEditingId(null);
  }

  async function handleCreate() {
    const finalTitle = title.trim();
    if (!finalTitle) {
      setError("일정을 선택하거나 이름을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    setDeliveredMsg(null);
    try {
      if (editingId) {
        const res = await fetch(`/api/parent/schedule/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            title: finalTitle,
            time: time.trim() || null,
            note: note.trim() || undefined,
            colorTag,
            reminderMinutes: reminderEnabled ? reminderMinutes : null,
            reminderEnabled,
            dateKey,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "수정하지 못했어요.");
        setDeliveredMsg("일정을 수정했어요.");
      } else {
        const res = await fetch("/api/parent/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            title: finalTitle,
            time: time.trim() || undefined,
            note: note.trim() || undefined,
            dateKey,
            templateId: templateId ?? undefined,
            colorTag,
            repeatRule,
            repeatWeekdays: repeatRule === "custom" ? weekdays : undefined,
            reminderMinutes: reminderEnabled ? reminderMinutes : null,
            reminderEnabled,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "저장하지 못했어요.");
        const count = typeof data.count === "number" ? data.count : 1;
        const when = time.trim()
          ? `${dateKey} ${time.trim()}`
          : `${dateKey} (시간 미정)`;
        setDeliveredMsg(
          count > 1
            ? `${when}부터 ${count}건 · 아이에게 전달됐어요! (${repeatLabelFor(repeatRule, weekdays)})`
            : `${when} · 아이에게 전달됐어요!`
        );
      }
      resetComposer();
      setComposerOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  async function patchItem(
    id: string,
    body: Record<string, unknown>,
    okMsg?: string
  ) {
    setError(null);
    try {
      const res = await fetch(`/api/parent/schedule/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "수정하지 못했어요.");
      if (okMsg) setDeliveredMsg(okMsg);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "수정하지 못했어요.");
    }
  }

  async function removeItem(id: string) {
    if (!window.confirm("이 일정을 삭제할까요? 아이 화면에서도 사라져요.")) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/parent/schedule/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "삭제하지 못했어요.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제하지 못했어요.");
    }
  }

  function startEdit(item: ScheduleItem) {
    setEditingId(item.id);
    setTemplateId((item.templateId as ScheduleTemplateId) ?? "custom");
    setType(item.type === "treatment" ? "treatment" : "exam");
    setTitle(item.title);
    setTime(item.time ?? "");
    setColorTag(item.colorTag ?? "#A8C5E8");
    setReminderEnabled(Boolean(item.reminderEnabled));
    setReminderMinutes(item.reminderMinutes ?? 10);
    setRepeatRule("once");
    setComposerOpen(true);
    setMoreOpen(true);
  }

  const canSubmit = title.trim().length > 0;

  if (!linked && !loading) {
    return (
      <ParentCard>
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-semibold text-slate-800">
            병원 일정
          </h3>
          <CalendarDays
            className="h-5 w-5 text-slate-700"
            strokeWidth={1.75}
          />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          아이와 연결하면 검사·치료 일정을 등록할 수 있어요.
        </p>
      </ParentCard>
    );
  }

  return (
    <ParentCard>
      <div className="flex items-center justify-between gap-3">
        <label className="min-w-0 flex-1">
          <span className="sr-only">날짜</span>
          <input
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none ring-slate-300 focus:ring-2"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setComposerOpen(true);
            setEditingId(null);
          }}
          className="h-10 shrink-0 rounded-lg bg-slate-800 px-3.5 text-[13px] font-medium text-white"
        >
          일정 추가
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="text-sm text-slate-400">불러오는 중…</p>
        ) : items.length === 0 && !composerOpen ? (
          <EmptyScheduleState onAdd={() => setComposerOpen(true)} />
        ) : items.length > 0 ? (
          items.map((item) => (
            <ScheduleCard
              key={item.id}
              item={item}
              onOpenActions={() => setActionItem(item)}
            />
          ))
        ) : null}
      </div>

      {composerOpen ? (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-slate-800">
              {editingId ? "일정 수정" : "새 일정"}
            </p>
            <button
              type="button"
              onClick={() => {
                resetComposer();
                setComposerOpen(false);
              }}
              className="text-[12px] text-slate-400 hover:text-slate-600"
            >
              닫기
            </button>
          </div>

          <FavoriteScheduleList
            favoriteIds={favorites}
            onPick={(id) => {
              const t = getScheduleTemplate(id);
              if (t) applyTemplate(t);
            }}
          />

          <ScheduleTemplateSelector
            selectedId={templateId}
            favorites={favorites}
            onSelect={applyTemplate}
            onToggleFavorite={toggleFavorite}
          />

          {(templateId === "custom" || !title) && templateId ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={40}
              placeholder="일정 이름"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none ring-slate-300 focus:ring-2"
            />
          ) : null}

          {templateId && title ? (
            <p className="text-[13px] font-medium text-slate-700">{title}</p>
          ) : null}

          <div>
            <p className="mb-1.5 text-[11px] font-medium text-slate-400">시간</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TIMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTime(t)}
                  className={cn(
                    "min-h-10 rounded-lg border px-3 text-[13px] font-medium tabular-nums",
                    time === t
                      ? "border-slate-800 bg-slate-800 text-white"
                      : "border-slate-200 bg-white text-slate-600"
                  )}
                >
                  {t}
                </button>
              ))}
              <label className="flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="bg-transparent text-[13px] outline-none"
                />
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="flex h-10 w-full items-center justify-between rounded-lg px-0.5 text-[12px] text-slate-500"
          >
            <span>반복 · 알림 · 메모</span>
            {moreOpen ? (
              <ChevronUp className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>

          {moreOpen ? (
            <div className="space-y-3 border-t border-slate-100 pt-3">
              {!editingId ? (
                <div>
                  <p className="mb-1.5 text-[12px] font-medium text-slate-500">
                    반복
                  </p>
                  <RepeatSelector
                    value={repeatRule}
                    weekdays={weekdays}
                    onChange={setRepeatRule}
                    onWeekdaysChange={setWeekdays}
                  />
                </div>
              ) : null}
              <ReminderSettings
                minutes={reminderMinutes}
                enabled={reminderEnabled}
                onChange={({ minutes, enabled }) => {
                  setReminderMinutes(minutes);
                  setReminderEnabled(enabled);
                }}
              />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="아이에게 전할 안내 (선택)"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-slate-300 focus:ring-2"
              />
            </div>
          ) : null}

          <button
            type="button"
            disabled={saving || !canSubmit}
            onClick={() => void handleCreate()}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-slate-800 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving
              ? editingId
                ? "저장 중…"
                : "등록 중…"
              : editingId
                ? "저장"
                : "등록하고 아이에게 전달"}
          </button>
        </div>
      ) : null}

      {deliveredMsg ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          {deliveredMsg}
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-xs text-rose-600">{error}</p>
      ) : null}

      <QuickActionMenu
        open={Boolean(actionItem)}
        title={actionItem?.title ?? ""}
        onClose={() => setActionItem(null)}
        actions={
          actionItem
            ? [
                {
                  id: "done",
                  label: actionItem.done ? "예정으로 되돌리기" : "완료 표시",
                  onClick: () =>
                    void patchItem(actionItem.id, {
                      done: !actionItem.done,
                      skipped: false,
                    }),
                },
                {
                  id: "skip",
                  label: actionItem.skipped
                    ? "건너뛰기 취소"
                    : "오늘 건너뛰기",
                  onClick: () =>
                    void patchItem(actionItem.id, {
                      skipped: !actionItem.skipped,
                      done: false,
                    }),
                },
                {
                  id: "tomorrow",
                  label: "내일로 복제",
                  onClick: () =>
                    void patchItem(
                      actionItem.id,
                      {
                        action: "repeat-tomorrow",
                        dateKey: actionItem.dateKey,
                      },
                      "내일 일정으로 복제했습니다."
                    ),
                },
                {
                  id: "week",
                  label: "이번 주 평일에도 추가",
                  onClick: () => {
                    void (async () => {
                      setSaving(true);
                      try {
                        const res = await fetch("/api/parent/schedule", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            type:
                              actionItem.type === "treatment"
                                ? "treatment"
                                : "exam",
                            title: actionItem.title,
                            time: actionItem.time,
                            dateKey: actionItem.dateKey,
                            templateId: actionItem.templateId,
                            colorTag: actionItem.colorTag,
                            repeatRule: "weekdays",
                            reminderMinutes: actionItem.reminderMinutes,
                            reminderEnabled: actionItem.reminderEnabled,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          throw new Error(data?.error ?? "추가하지 못했어요.");
                        }
                        setDeliveredMsg(
                          `평일 일정 ${data.count ?? ""}건을 추가했습니다.`
                        );
                        await load();
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "추가하지 못했어요."
                        );
                      } finally {
                        setSaving(false);
                      }
                    })();
                  },
                },
                {
                  id: "duplicate",
                  label: "같은 날 복제",
                  onClick: () =>
                    void patchItem(
                      actionItem.id,
                      { action: "duplicate", dateKey: actionItem.dateKey },
                      "일정을 복제했습니다."
                    ),
                },
                {
                  id: "edit",
                  label: "수정",
                  onClick: () => startEdit(actionItem),
                },
                {
                  id: "delete",
                  label: "삭제",
                  tone: "danger",
                  onClick: () => void removeItem(actionItem.id),
                },
              ]
            : []
        }
      />
    </ParentCard>
  );
}
