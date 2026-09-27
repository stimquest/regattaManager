import Link from "next/link";
import { ArrowRight, Wind } from "lucide-react";
import { BrandMark, Sailboat } from "@/components/icons";
import { cn } from "@/lib/utils";

const activities = [
  {
    href: "/regattas",
    surface: "surface-ink",
    icon: Sailboat,
    eyebrow: "Comité de course",
    eyebrowTone: "text-signal",
    title: "Régates",
    text: "Inscriptions et dossards, arrivées des manches, classement général.",
    arrow: "bg-signal text-signal-foreground",
  },
  {
    href: "/land-yachting",
    surface: "surface-teal",
    icon: Wind,
    eyebrow: "Séances du club",
    eyebrowTone: "text-amber-300",
    title: "Char à voile",
    text: "Accueil des pilotes, présences et défi du jour.",
    arrow: "bg-amber-300 text-teal-950",
  },
];

// Premier écran : on choisit son activité, rien d'autre. Statique, donc instantané et disponible hors ligne.
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] md:justify-center md:px-8 md:py-12">
      <header className="flex items-center gap-4 pb-6 md:pb-10">
        <BrandMark className="h-12 w-12 shrink-0 shadow-lift [border-radius:10px]" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">Bonjour</p>
          <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-tight md:text-4xl">Quelle activité aujourd’hui ?</h1>
        </div>
      </header>

      <div className="rise-stagger grid flex-1 grid-cols-1 grid-rows-2 gap-3 md:flex-none md:grid-cols-2 md:grid-rows-1 md:gap-5">
        {activities.map(activity => (
          <Link
            key={activity.href}
            href={activity.href}
            className={cn(
              activity.surface,
              "pressable group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[32px] p-6 shadow-lift md:min-h-[420px] md:p-8"
            )}
          >
            <activity.icon
              aria-hidden="true"
              strokeWidth={1.25}
              className="pointer-events-none absolute -bottom-8 -right-8 h-52 w-52 text-white/[0.07] transition-transform duration-500 ease-out group-hover:-translate-y-1 group-hover:-rotate-3 md:h-72 md:w-72"
            />
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-inset ring-white/15">
              <activity.icon className="h-6 w-6" />
            </span>
            <div className="relative">
              <p className={cn("mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em]", activity.eyebrowTone)}>
                <span aria-hidden="true" className="h-px w-6 bg-current" />
                {activity.eyebrow}
              </p>
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-display text-4xl font-extrabold leading-none tracking-tight md:text-5xl">{activity.title}</h2>
                  <p className="mt-2.5 max-w-xs text-[15px] leading-snug text-white/70">{activity.text}</p>
                </div>
                <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-lift transition-transform duration-200 ease-out group-hover:translate-x-1", activity.arrow)}>
                  <ArrowRight className="h-5 w-5" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
