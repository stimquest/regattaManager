import { cn } from "@/lib/utils";

/** Petit calendrier détaché : mois en haut, jour en grand. */
export function DateBlock({ date, tone = "primary", className }: { date: string; tone?: "primary" | "teal" | "muted"; className?: string }) {
  const value = new Date(`${date}T12:00:00`);
  const month = value.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
  const day = value.getDate();
  return (
    <span
      className={cn(
        "flex h-16 w-14 shrink-0 flex-col overflow-hidden rounded-2xl border bg-card text-center shadow-soft",
        className
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          "py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
          tone === "primary" && "bg-primary text-primary-foreground",
          tone === "teal" && "bg-teal-600 text-white",
          tone === "muted" && "bg-muted-foreground/80 text-background"
        )}
      >
        {month}
      </span>
      <span className="flex flex-1 items-center justify-center font-display text-2xl font-extrabold tabular-nums leading-none">{day}</span>
    </span>
  );
}
