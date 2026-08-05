import { Check, Clock, Pill } from "lucide-react";
import { cn } from "@/frontend/shared/lib/utils";

export type MedicationStatus = "taken" | "scheduled" | "missed";

export interface MedicationItem {
  id: string;
  name: string;
  dosage: string;
  scheduledAt: string;
  status: MedicationStatus;
  notes?: string;
}

export interface MedicationLogProps {
  medications: MedicationItem[];
}

const statusConfig: Record<
  MedicationStatus,
  { label: string; icon: typeof Check; className: string }
> = {
  taken: {
    label: "복용함",
    icon: Check,
    className: "bg-bedi-sage/15 text-bedi-sage",
  },
  scheduled: {
    label: "예정",
    icon: Clock,
    className: "bg-bedi-slate/8 text-bedi-slate/60",
  },
  missed: {
    label: "미복용",
    icon: Pill,
    className: "bg-bedi-rose/20 text-bedi-rose",
  },
};

export function MedicationLog({ medications }: MedicationLogProps) {
  return (
    <section className="rounded-2xl bg-bedi-card p-8 shadow-soft">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bedi-sage/15 text-bedi-sage">
          <Pill className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-bedi-slate">복약 기록</h2>
          <p className="text-sm text-bedi-slate/50">오늘의 일정</p>
        </div>
      </div>

      <ul className="space-y-0">
        {medications.map((med, index) => {
          const config = statusConfig[med.status];
          const StatusIcon = config.icon;
          const isLast = index === medications.length - 1;

          return (
            <li key={med.id} className="relative flex gap-4 pb-6 last:pb-0">
              {!isLast && (
                <span
                  className="absolute left-[15px] top-8 h-[calc(100%-16px)] w-px bg-bedi-sage/25"
                  aria-hidden
                />
              )}
              <div
                className={cn(
                  "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  config.className
                )}
              >
                <StatusIcon className="h-3.5 w-3.5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-bedi-slate">{med.name}</p>
                  <time className="text-xs font-medium tabular-nums text-bedi-sage">
                    {med.scheduledAt}
                  </time>
                </div>
                <p className="mt-0.5 text-sm text-bedi-slate/55">
                  {med.dosage}
                  <span className="mx-1.5 text-bedi-slate/25">·</span>
                  <span className="text-bedi-slate/45">{config.label}</span>
                </p>
                {med.notes && (
                  <p className="mt-1.5 text-sm leading-relaxed text-bedi-slate/45">
                    {med.notes}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
