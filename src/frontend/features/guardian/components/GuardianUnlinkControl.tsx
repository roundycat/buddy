"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function GuardianUnlinkControl() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function unlink() {
    if (pending) return;
    const ok = window.confirm("아이와의 연결을 해제할까요?");
    if (!ok) return;
    setPending(true);
    try {
      const res = await fetch("/api/guardian/link", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "연결 해제에 실패했어요.");
      }
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "연결 해제에 실패했어요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void unlink()}
      disabled={pending}
      className="mx-auto block text-[11px] text-bedi-slate/30 underline-offset-2 transition hover:text-bedi-slate/50 hover:underline disabled:opacity-50"
    >
      {pending ? "해제 중…" : "아이 연결 해제"}
    </button>
  );
}
