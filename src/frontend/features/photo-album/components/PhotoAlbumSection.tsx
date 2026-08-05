"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PhotoAlbumListItem } from "@/backend/features/photo-album/photo-album.types";

/**
 * Memory page photo album grid — loads from /api/photos.
 */
export function PhotoAlbumSection() {
  const [photos, setPhotos] = useState<PhotoAlbumListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/photos");
        const json = (await res.json()) as {
          photos?: PhotoAlbumListItem[];
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? "사진첩을 불러오지 못했어요.");
        if (!cancelled) setPhotos(json.photos ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "사진첩을 불러오지 못했어요."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs tracking-wide text-bedi-slate/40">사진첩</p>
        <Link
          href="/adventure"
          className="text-[11px] text-bedi-sage underline-offset-2 hover:underline"
        >
          모험에서 사진 남기기
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-bedi-slate/40">불러오는 중…</p>
      ) : error ? (
        <p className="text-sm text-bedi-slate/45">{error}</p>
      ) : photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bedi-slate/15 bg-white/60 px-4 py-6 text-center">
          <p className="text-sm text-bedi-slate/50">
            아직 올린 사진이 없어요.
          </p>
          <p className="mt-1 text-xs text-bedi-slate/35">
            모험 미션에서 사진을 올리면 여기에 모아져요.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="overflow-hidden rounded-2xl border border-bedi-slate/8 bg-white shadow-softer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.caption || "모험 사진"}
                className="aspect-square w-full object-cover"
              />
              {photo.caption ? (
                <p className="truncate px-2 py-1.5 text-[10px] text-bedi-slate/45">
                  {photo.caption}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
