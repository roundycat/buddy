"use client";

import { useLocalWeather } from "@/frontend/features/waiting-room/hooks/useLocalWeather";

/**
 * Soft weather line for waiting-room header (location-based).
 */
export function WaitingRoomWeather() {
  const { weather, status } = useLocalWeather();

  if (status === "loading" || status === "idle") {
    return (
      <p className="mt-2 text-[11px] tracking-wide text-bedi-slate/30">
        날씨를 살피는 중…
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className="mt-2 text-[11px] tracking-wide text-bedi-slate/30">
        위치 허용 시 오늘 날씨를 보여 줘요
      </p>
    );
  }

  if (status === "error" || !weather) {
    return (
      <p className="mt-2 text-[11px] tracking-wide text-bedi-slate/30">
        오늘 날씨는 잠시 쉬어 가요
      </p>
    );
  }

  return (
    <p className="mt-2 text-[12px] tracking-wide text-bedi-slate/50">
      {weather.place ? (
        <span className="text-bedi-slate/40">{weather.place} · </span>
      ) : null}
      <span aria-hidden>{weather.emoji}</span> {weather.label}
      <span className="tabular-nums text-bedi-slate/55">
        {" "}
        · {weather.tempC}°
      </span>
    </p>
  );
}
