"use client";

import { useEffect, useState } from "react";

export interface LocalWeather {
  emoji: string;
  label: string;
  tempC: number;
  place?: string;
}

/**
 * Geolocation → Beddy server weather API (coarse coords only).
 * External weather providers see ECS IP, not the child's device.
 */
export function useLocalWeather() {
  const [weather, setWeather] = useState<LocalWeather | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "denied" | "error"
  >("idle");

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setStatus("denied");
      return;
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
            setWeather({
              emoji: data.emoji || "🌤️",
              label: data.label || "날씨",
              tempC: typeof data.tempC === "number" ? data.tempC : 0,
            });
            setStatus("ready");
          } catch {
            setStatus("error");
          }
        })();
      },
      () => setStatus("denied"),
      {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 10 * 60 * 1000,
      }
    );
  }, []);

  return { weather, status };
}
