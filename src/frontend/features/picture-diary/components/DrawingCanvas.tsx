"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Eraser, Undo2 } from "lucide-react";
import { cn } from "@/frontend/shared/lib/utils";

/** Fixed drawing resolution so a saved page looks the same on any screen. */
const WIDTH = 1024;
const HEIGHT = 768;

const PAPER = "#FBF8F1";

const CRAYONS = [
  { id: "slate", label: "먹빛", color: "#4A5568" },
  { id: "rose", label: "분홍", color: "#E88AA0" },
  { id: "amber", label: "노랑", color: "#F0B860" },
  { id: "sage", label: "초록", color: "#84A98C" },
  { id: "sky", label: "하늘", color: "#7BA7CC" },
  { id: "violet", label: "보라", color: "#A78BC0" },
  { id: "brown", label: "갈색", color: "#B08968" },
  { id: "coral", label: "주황", color: "#E9866A" },
] as const;

const SIZES = [
  { id: "thin", label: "얇게", width: 6 },
  { id: "medium", label: "보통", width: 14 },
  { id: "thick", label: "굵게", width: 28 },
] as const;

interface Stroke {
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

export interface DrawingCanvasHandle {
  /** Base64 PNG of the drawing, or null when the page is still blank. */
  exportPng: () => string | null;
  isBlank: () => boolean;
  clear: () => void;
}

export const DrawingCanvas = forwardRef<DrawingCanvasHandle>(
  function DrawingCanvas(_props, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const strokesRef = useRef<Stroke[]>([]);
    const activeRef = useRef<Stroke | null>(null);
    const [color, setColor] = useState<string>(CRAYONS[0].color);
    const [width, setWidth] = useState<number>(SIZES[1].width);
    const [erasing, setErasing] = useState(false);
    const [strokeCount, setStrokeCount] = useState(0);

    const redraw = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const all = activeRef.current
        ? [...strokesRef.current, activeRef.current]
        : strokesRef.current;

      for (const stroke of all) {
        if (stroke.points.length === 0) continue;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.beginPath();
        const [first, ...rest] = stroke.points;
        ctx.moveTo(first!.x, first!.y);
        if (rest.length === 0) {
          // A single tap should still leave a dot.
          ctx.lineTo(first!.x + 0.1, first!.y);
        }
        for (const point of rest) ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
    }, []);

    useEffect(() => {
      redraw();
    }, [redraw]);

    useImperativeHandle(
      ref,
      () => ({
        exportPng: () => {
          if (strokesRef.current.length === 0) return null;
          return canvasRef.current?.toDataURL("image/png") ?? null;
        },
        isBlank: () => strokesRef.current.length === 0,
        clear: () => {
          strokesRef.current = [];
          activeRef.current = null;
          setStrokeCount(0);
          redraw();
        },
      }),
      [redraw]
    );

    function pointFrom(event: React.PointerEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
      };
    }

    function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
      event.currentTarget.setPointerCapture(event.pointerId);
      activeRef.current = {
        color: erasing ? PAPER : color,
        width: erasing ? Math.max(width, 24) : width,
        points: [pointFrom(event)],
      };
      redraw();
    }

    function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
      if (!activeRef.current) return;
      activeRef.current.points.push(pointFrom(event));
      redraw();
    }

    function endStroke() {
      const active = activeRef.current;
      activeRef.current = null;
      if (!active) return;
      strokesRef.current = [...strokesRef.current, active];
      setStrokeCount(strokesRef.current.length);
      redraw();
    }

    function undo() {
      strokesRef.current = strokesRef.current.slice(0, -1);
      setStrokeCount(strokesRef.current.length);
      redraw();
    }

    return (
      <div className="space-y-3">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          onPointerCancel={endStroke}
          className="w-full cursor-crosshair touch-none rounded-2xl border border-bedi-slate/12 bg-[#FBF8F1] shadow-softer"
          style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
          aria-label="그림 그리는 곳"
        />

        <div className="flex flex-wrap items-center gap-1.5">
          {CRAYONS.map((crayon) => {
            const active = !erasing && color === crayon.color;
            return (
              <button
                key={crayon.id}
                type="button"
                aria-label={crayon.label}
                title={crayon.label}
                aria-pressed={active}
                onClick={() => {
                  setColor(crayon.color);
                  setErasing(false);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/40"
              >
                <span
                  className={cn(
                    "block h-9 w-9 rounded-full border-2 transition-transform",
                    active
                      ? "scale-110 border-bedi-slate/45"
                      : "border-white/70 hover:scale-105"
                  )}
                  style={{ backgroundColor: crayon.color }}
                />
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          {SIZES.map((size) => {
            const active = width === size.width;
            return (
              <button
                key={size.id}
                type="button"
                aria-pressed={active}
                onClick={() => setWidth(size.width)}
                className={cn(
                  "h-11 flex-1 rounded-xl border text-xs font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/40",
                  active
                    ? "border-bedi-sage/45 bg-bedi-sage/12 text-bedi-slate"
                    : "border-bedi-slate/12 bg-white text-bedi-slate/55"
                )}
              >
                {size.label}
              </button>
            );
          })}

          <button
            type="button"
            aria-pressed={erasing}
            onClick={() => setErasing((v) => !v)}
            aria-label="지우개"
            title="지우개"
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl border transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/40",
              erasing
                ? "border-bedi-rose/40 bg-bedi-rose/10 text-bedi-rose"
                : "border-bedi-slate/12 bg-white text-bedi-slate/50"
            )}
          >
            <Eraser className="h-4 w-4" strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={undo}
            disabled={strokeCount === 0}
            aria-label="한 번 되돌리기"
            title="한 번 되돌리기"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-bedi-slate/12 bg-white text-bedi-slate/50 disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/40"
          >
            <Undo2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    );
  }
);
