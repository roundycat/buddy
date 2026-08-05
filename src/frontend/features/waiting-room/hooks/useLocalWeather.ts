"use client";

import { useEffect, useState } from "react";

export interface LocalWeather {
  emoji: string;
  label: string;
  tempC: number;
  place?: string;
}

function weatherFromCode(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: "☀️", label: "맑음" };
  if (code <= 3) return { emoji: "⛅", label: "구름 조금" };
  if (code <= 48) return { emoji: "🌫️", label: "안개" };
  if (code <= 57) return { emoji: "🌦️", label: "이슬비" };
  if (code <= 67) return { emoji: "🌧️", label: "비" };
  if (code <= 77) return { emoji: "🌨️", label: "눈" };
  if (code <= 82) return { emoji: "🌧️", label: "소나기" };
  if (code <= 86) return { emoji: "🌨️", label: "눈 소나기" };
  if (code <= 99) return { emoji: "⛈️", label: "뇌우" };
  return { emoji: "🌤️", label: "날씨" };
}

async function reversePlace(lat: number, lon: number): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ko`
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
    };
    return (
      data.locality ||
      data.city ||
      data.principalSubdivision ||
      undefined
    );
  } catch {
    return undefined;
  }
}

async function fetchWeather(lat: number, lon: number): Promise<LocalWeather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("날씨를 불러오지 못했어요.");
  const data = (await res.json()) as {
    current?: { temperature_2m?: number; weather_code?: number };
  };
  const temp = Math.round(data.current?.temperature_2m ?? 0);
  const code = data.current?.weather_code ?? 1;
  const meta = weatherFromCode(code);
  const place = await reversePlace(lat, lon);
  return { ...meta, tempC: temp, place };
}

/**
 * Browser geolocation → Open-Meteo current weather (no API key).
 */
export function useLocalWeather() {
  const [weather, setWeather] = useState<LocalWeather | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "denied" | "error">(
    "idle"
  );

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
            const next = await fetchWeather(
              pos.coords.latitude,
              pos.coords.longitude
            );
            setWeather(next);
            setStatus("ready");
          } catch {
            setStatus("error");
          }
        })();
      },
      () => setStatus("denied"),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60 * 1000 }
    );
  }, []);

  return { weather, status };
}
