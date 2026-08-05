import "server-only";
import { todayKey } from "@/backend/shared/time/date";
import {
  getCoarseLocation,
  roundCoord,
  saveCoarseLocation,
} from "./weather.store";

/** Seoul National University Hospital area — default when no coarse location */
export const DEFAULT_WEATHER_LAT = 37.6;
export const DEFAULT_WEATHER_LON = 127.0;

export type WeatherCode = "sunny" | "rainy" | "cloudy";

export interface WeatherSnapshot {
  code: WeatherCode;
  label: string;
  emoji: string;
  tempC?: number;
  /** Daily forecast for dateKey (batch should use this, not "current") */
  dateKey: string;
  source: "forecast" | "fallback";
}

const forecastCache = new Map<
  string,
  { at: number; value: WeatherSnapshot }
>();
const CACHE_MS = 45 * 60 * 1000;

export function weatherFromWmoCode(code: number): Omit<
  WeatherSnapshot,
  "dateKey" | "source" | "tempC"
> {
  if (code === 0) return { code: "sunny", label: "맑음", emoji: "☀️" };
  if (code <= 3) return { code: "cloudy", label: "구름 조금", emoji: "⛅" };
  if (code <= 48) return { code: "cloudy", label: "안개", emoji: "🌫️" };
  if (code <= 67) return { code: "rainy", label: "비", emoji: "🌧️" };
  if (code <= 77) return { code: "cloudy", label: "눈", emoji: "🌨️" };
  if (code <= 82) return { code: "rainy", label: "소나기", emoji: "🌧️" };
  if (code <= 99) return { code: "rainy", label: "뇌우", emoji: "⛈️" };
  return { code: "cloudy", label: "흐림", emoji: "☁️" };
}

function hashSeed(date: string): number {
  let h = 0;
  for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function fallbackWeather(dateKey: string): WeatherSnapshot {
  const roll = hashSeed(dateKey) % 3;
  if (roll === 0) {
    return {
      code: "sunny",
      label: "맑음",
      emoji: "☀️",
      dateKey,
      source: "fallback",
    };
  }
  if (roll === 1) {
    return {
      code: "rainy",
      label: "비",
      emoji: "🌧️",
      dateKey,
      source: "fallback",
    };
  }
  return {
    code: "cloudy",
    label: "흐림",
    emoji: "☁️",
    dateKey,
    source: "fallback",
  };
}

/**
 * Daily forecast for a date (Open-Meteo). Prefer over "current" for dawn batch.
 */
export async function fetchDailyForecast(input: {
  lat: number;
  lon: number;
  dateKey?: string;
}): Promise<WeatherSnapshot> {
  const dateKey = input.dateKey ?? todayKey();
  const lat = roundCoord(input.lat);
  const lon = roundCoord(input.lon);
  const cacheKey = `${lat},${lon},${dateKey}`;
  const cached = forecastCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("daily", "weather_code,temperature_2m_max");
    url.searchParams.set("timezone", "Asia/Seoul");
    url.searchParams.set("start_date", dateKey);
    url.searchParams.set("end_date", dateKey);

    const res = await fetch(url.toString(), {
      next: { revalidate: 1800 },
    } as RequestInit);
    if (!res.ok) throw new Error(`weather http ${res.status}`);
    const data = (await res.json()) as {
      daily?: {
        weather_code?: number[];
        temperature_2m_max?: number[];
      };
    };
    const wmo = data.daily?.weather_code?.[0] ?? 1;
    const temp = data.daily?.temperature_2m_max?.[0];
    const meta = weatherFromWmoCode(wmo);
    const value: WeatherSnapshot = {
      ...meta,
      tempC: typeof temp === "number" ? Math.round(temp) : undefined,
      dateKey,
      source: "forecast",
    };
    forecastCache.set(cacheKey, { at: Date.now(), value });
    return value;
  } catch (error) {
    console.error("[weather] daily forecast failed", error);
    return fallbackWeather(dateKey);
  }
}

/** Resolve weather for a child: coarse location → hospital default. */
export async function getWeatherForUser(
  userId: string | undefined,
  dateKey = todayKey()
): Promise<WeatherSnapshot> {
  if (userId) {
    const loc = await getCoarseLocation(userId);
    if (loc) {
      return fetchDailyForecast({ lat: loc.lat, lon: loc.lon, dateKey });
    }
  }
  return fetchDailyForecast({
    lat: DEFAULT_WEATHER_LAT,
    lon: DEFAULT_WEATHER_LON,
    dateKey,
  });
}

export async function reportCoarseLocation(
  userId: string,
  lat: number,
  lon: number
): Promise<WeatherSnapshot> {
  await saveCoarseLocation(userId, lat, lon);
  return getWeatherForUser(userId, todayKey());
}
