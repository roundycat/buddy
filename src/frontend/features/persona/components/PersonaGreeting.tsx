import { HeartHandshake } from "lucide-react";

export interface PersonaGreetingProps {
  name: string;
  role: string;
  greeting: string;
  companionMessage: string;
}

export function PersonaGreeting({
  name,
  role,
  greeting,
  companionMessage,
}: PersonaGreetingProps) {
  return (
    <section className="rounded-2xl bg-bedi-card p-8 shadow-soft">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-bedi-sage/15 text-bedi-sage">
          <HeartHandshake className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 space-y-3">
          <div>
            <p className="text-xs font-medium tracking-[0.14em] text-bedi-slate/50">
              {role}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-bedi-slate">
              {name}
            </h1>
          </div>
          <p className="text-base leading-relaxed text-bedi-slate/80">{greeting}</p>
          <p className="border-l-2 border-bedi-rose/60 pl-4 text-sm leading-relaxed text-bedi-slate/60">
            {companionMessage}
          </p>
        </div>
      </div>
    </section>
  );
}
