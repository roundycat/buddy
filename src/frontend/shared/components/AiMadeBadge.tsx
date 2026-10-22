import { cn } from "@/frontend/shared/lib/utils";

/**
 * Marks AI-generated pictures (인공지능기본법: 생성형 AI 결과물 표시).
 * Small, legible, never covering faces — sits in a corner of the image.
 */
export function AiMadeBadge({
  className,
  label = "AI로 그렸어요",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute z-10 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-medium tracking-tight text-bedi-slate/70 shadow-sm",
        className ?? "bottom-1.5 right-1.5"
      )}
    >
      {label}
    </span>
  );
}
