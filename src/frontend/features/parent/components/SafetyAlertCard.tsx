"use client";

import { useState } from "react";
import type { ParentSafetyAlert } from "@/backend/features/parent/parent.types";

export function SafetyAlertCard({ alert }: { alert: ParentSafetyAlert }) {
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (dismissed) return null;

  async function acknowledge() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/parent/safety-alert", { method: "POST" });
      if (res.ok) setDismissed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="alert"
      className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-4 py-4 text-slate-800 shadow-sm"
    >
      <p className="text-[11px] font-medium tracking-wide text-rose-700/80">
        {alert.level === "urgent" ? "긴급 안전 알림" : "정서 안전 알림"}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">
        {alert.summary}
      </p>
      <p className="mt-2 text-[11px] text-slate-500">
        대화 원문은 공유되지 않습니다. 자살예방 상담전화 109 · 응급 119
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void acknowledge()}
        className="mt-3 min-h-11 rounded-full bg-slate-800 px-4 text-xs font-medium text-white disabled:opacity-50"
      >
        {busy ? "확인 중…" : "확인했어요"}
      </button>
    </div>
  );
}
