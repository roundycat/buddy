"use client";

import { useEffect, useState } from "react";

export interface LocalWeather {
  emoji: string;
  label: string;
  /** Unknown when the server has only a fallback sky — then no number is shown. */
  tempC: number | null;
}

async function fetchFallbackWeather(): Promise<LocalWeather | null> {
  try {
    const res = await fetch("/api/weather");
    if (!res.ok) return null;
    const data = (await res.json()) as {
      emoji?: string;
      label?: string;
      tempC?: number | null;
    };
    return {
      emoji: data.emoji || "🌤️",
      label: data.label || "날씨",
      tempC: typeof data.tempC === "number" ? data.tempC : null,
    };
  } catch {
    return null;
  }
}

/**
 * Geolocation → Beddy server weather API (coarse coords only).
 * External weather providers see ECS IP, not the child's device.
 * If location is denied, falls back to GET /api/weather (hospital default).
 */
export function useLocalWeather() {
  const [weather, setWeather] = useState<LocalWeather | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "denied" | "error"
  >("idle");

  useEffect(() => {
    let cancelled = false;

    async function applyFallback() {
      const fallback = await fetchFallbackWeather();
      if (cancelled) return;
      if (fallback) {
        setWeather(fallback);
        setStatus("ready");
      } else {
        setStatus("denied");
      }
    }

    if (typeof window === "undefined" || !navigator.geolocation) {
      setStatus("loading");
      void applyFallback();
      return () => {
        cancelled = true;
      };
    }

    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void (async () => {
          try {
            const lat = Math.round(pos.coords.latitude * 10) / 10;
            const lon = Math.round(pos.coords.longitude * 10) / 10;
            const res = await fetch("/api/weather", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lat, lon }),
            });
            if (!res.ok) throw new Error("weather api");
            const data = (await res.json()) as {
              emoji?: string;
              label?: string;
              tempC?: number | null;
            };
            if (cancelled) return;
            setWeather({
              emoji: data.emoji || "🌤️",
              label: data.label || "날씨",
              tempC: typeof data.tempC === "number" ? data.tempC : null,
            });
            setStatus("ready");
          } catch {
            if (!cancelled) await applyFallback();
          }
        })();
      },
      () => {
        void applyFallback();
      },
      {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 10 * 60 * 1000,
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return { weather, status };
}
