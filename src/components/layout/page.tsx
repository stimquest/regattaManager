import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Conteneur de page : marges latérales, encoche en haut, barre d'onglets en bas. */
export function Page({ className, children, width = "wide" }: { className?: string; children: React.ReactNode; width?: "wide" | "narrow" }) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-6 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] md:gap-8 md:px-8 md:pb-12 md:pt-8",
        width === "wide" ? "max-w-6xl" : "max-w-4xl",
        className
      )}
    >
      {children}
    </main>
  );
}

/** En-tête marin des pages principales. */
export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
  tone = "ink",
}: {
  tone?: "ink" | "teal";
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(tone === "teal" ? "surface-teal" : "surface-ink", "relative overflow-hidden rounded-[28px] p-6 shadow-lift md:p-9", className)}>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 max-w-2xl">
          {eyebrow && (
            <p className={cn("mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em]", tone === "teal" ? "text-amber-300" : "text-signal")}>
              <span aria-hidden="true" className={cn("h-px w-6", tone === "teal" ? "bg-amber-300" : "bg-signal")} />
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-[34px] font-extrabold leading-[1.05] tracking-tight md:text-5xl">{title}</h1>
          {description && <p className="mt-3 text-[15px] leading-relaxed text-white/70 md:text-base">{description}</p>}
        </div>
        {actions && <div className="flex w-full shrink-0 flex-wrap gap-2 md:w-auto">{actions}</div>}
      </div>
      {children && <div className="mt-6 md:mt-8">{children}</div>}
    </section>
  );
}

/** En-tête compact des écrans de détail, avec retour. */
export function DetailHeader({
  backHref,
  onBack,
  backLabel = "Retour",
  eyebrow,
  title,
  meta,
  actions,
  tone = "ink",
}: {
  tone?: "ink" | "teal";
  backHref?: string;
  onBack?: () => void;
  backLabel?: string;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const backClass =
    "press-feedback flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-card shadow-soft hover:bg-muted";
  return (
    <header className="flex items-start gap-3">
      {backHref ? (
        <Link href={backHref} aria-label={backLabel} className={backClass}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
      ) : onBack ? (
        <button type="button" onClick={onBack} aria-label={backLabel} className={backClass}>
          <ArrowLeft className="h-5 w-5" />
        </button>
      ) : null}
      <div className="min-w-0 flex-1 pt-0.5">
        {eyebrow && <p className={cn("text-[11px] font-bold uppercase tracking-[0.18em]", tone === "teal" ? "text-teal-700 dark:text-teal-300" : "text-signal")}>{eyebrow}</p>}
        <h1 className="mt-0.5 truncate font-display text-2xl font-extrabold leading-tight tracking-tight md:text-3xl">{title}</h1>
        {meta && <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionHeader({ title, description, action, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-xl font-bold tracking-tight md:text-2xl">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action, className }: { icon?: React.ElementType; title: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-3xl border border-dashed bg-card/60 px-6 py-12 text-center", className)}>
      {Icon && (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-7 w-7" />
        </span>
      )}
      <p className="font-display text-lg font-bold">{title}</p>
      {children && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Chiffre clé sur fond marin. */
export function HeroStat({ value, label }: { value: React.ReactNode; label: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/[0.06] px-4 py-3 ring-1 ring-inset ring-white/10">
      <p className="font-display text-3xl font-extrabold leading-none tabular-nums">{value}</p>
      <p className="mt-1.5 truncate text-xs font-medium text-white/60">{label}</p>
    </div>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex h-2.5 w-2.5", className)} aria-hidden="true">
      <span className="absolute inset-0 animate-live-ping rounded-full bg-signal" />
      <span className="relative h-2.5 w-2.5 rounded-full bg-signal" />
    </span>
  );
}

export function Bib({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("bib", className)}>{children}</span>;
}

/** Pastille de rang : or, argent, bronze pour le podium. */
export function RankBadge({ rank, className }: { rank: number | string | null | undefined; className?: string }) {
  const tone =
    rank === 1
      ? "bg-amber-400 text-amber-950 shadow-[inset_0_-2px_0_rgba(0,0,0,0.15)]"
      : rank === 2
        ? "bg-slate-300 text-slate-900 shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]"
        : rank === 3
          ? "bg-orange-300 text-orange-950 shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]"
          : "bg-muted text-foreground";
  return (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-base font-extrabold tabular-nums", tone, className)}>
      {rank ?? "–"}
    </span>
  );
}

export function PageLoader({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60dvh] flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-7 w-7 animate-spin text-primary [animation-duration:700ms]" />
      {label}
    </div>
  );
}
