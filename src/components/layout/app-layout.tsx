"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, CloudOff, House, Users, Wind } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark, Sailboat } from "@/components/icons";
import { useOnline } from "@/hooks/use-online";

type NavItem = { href: string; icon: React.ElementType; label: string; match: (pathname: string) => boolean };

/**
 * Deux espaces qui ne partagent rien : les concurrents de régate ne sont pas
 * les pilotes des séances de char à voile. Chacun a sa navigation et sa couleur.
 */
const spaces = {
  regattas: {
    label: "Régates",
    tagline: "Comité de course",
    surface: "surface-ink",
    marker: "bg-signal",
    active: "text-primary",
    activeBg: "bg-primary/12",
    match: (p: string) => p.startsWith("/regatta") || p.startsWith("/runners") || p.startsWith("/results"),
    items: [
      { href: "/regattas", icon: Sailboat, label: "Régates", match: (p: string) => p.startsWith("/regatta") || p.startsWith("/results") },
      { href: "/runners", icon: Users, label: "Coureurs", match: (p: string) => p.startsWith("/runners") },
    ] as NavItem[],
  },
  landYachting: {
    label: "Char à voile",
    tagline: "Séances du club",
    surface: "surface-teal",
    marker: "bg-amber-300",
    active: "text-teal-700 dark:text-teal-300",
    activeBg: "bg-teal-500/15",
    match: (p: string) => p.startsWith("/land-yachting"),
    items: [
      { href: "/land-yachting", icon: Wind, label: "Séances", match: (p: string) => p.startsWith("/land-yachting") },
    ] as NavItem[],
  },
};

type Space = (typeof spaces)[keyof typeof spaces];

const home: NavItem = { href: "/", icon: House, label: "Accueil", match: (p) => p === "/" };

function MobileTabBar({ pathname, space }: { pathname: string; space: Space }) {
  const items = [home, ...space.items];
  return (
    <nav
      aria-label={`Navigation ${space.label}`}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/85 pb-safe backdrop-blur-xl backdrop-saturate-150 md:hidden"
    >
      <ul className="mx-auto flex max-w-md justify-around">
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press-feedback flex h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-semibold",
                  active ? space.active : "text-muted-foreground"
                )}
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-150 ease-out", active && space.activeBg)}>
                  <item.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DesktopSidebar({ pathname, space }: { pathname: string; space: Space }) {
  const online = useOnline();
  return (
    <aside className={cn(space.surface, "fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col px-4 py-6 md:flex")}>
      <Link href="/" className="mb-8 flex items-center gap-3 px-2" aria-label="Retour à l’accueil">
        <BrandMark className="h-10 w-10 shadow-lift ring-1 ring-white/10 [border-radius:9px]" />
        <span>
          <span className="block font-display text-xl font-extrabold leading-none tracking-tight">{space.label}</span>
          <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">{space.tagline}</span>
        </span>
      </Link>
      <nav aria-label={`Navigation ${space.label}`} className="flex-1">
        <ul className="space-y-1">
          {space.items.map((item) => {
            const active = item.match(pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "press-feedback relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold",
                    active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {active && <span aria-hidden="true" className={cn("absolute -left-4 top-2.5 h-6 w-1 rounded-r-full", space.marker)} />}
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="space-y-2">
        <Link href="/" className="press-feedback flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/60 hover:bg-white/5 hover:text-white">
          <ArrowLeftRight className="h-5 w-5" />
          Changer d’activité
        </Link>
        <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-xs text-white/60">
          <span className={cn("h-2 w-2 rounded-full", online ? "bg-emerald-400" : "bg-signal")} />
          {online ? "Synchronisé" : "Hors ligne · saisies conservées"}
        </div>
      </div>
    </aside>
  );
}

function OfflineBanner({ always = false }: { always?: boolean }) {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className={cn(
        "sticky top-0 z-40 flex items-center justify-center gap-2 bg-signal px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-center text-[13px] font-semibold text-signal-foreground",
        !always && "md:hidden"
      )}
    >
      <CloudOff className="h-4 w-4 shrink-0" />
      Hors ligne · vos saisies seront synchronisées au retour du réseau
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";

  // L'habillage OBS est incrusté dans une vidéo : aucune navigation.
  if (pathname.startsWith("/obs")) {
    return <>{children}</>;
  }

  const space = spaces.regattas.match(pathname) ? spaces.regattas : spaces.landYachting.match(pathname) ? spaces.landYachting : null;

  // Accueil : on choisit son activité, sans navigation autour.
  if (!space) {
    return (
      <div className="flex min-h-dvh w-full flex-col bg-background">
        <OfflineBanner always />
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full bg-background">
      <DesktopSidebar pathname={pathname} space={space} />
      <div className="flex min-h-dvh flex-col md:pl-[248px]">
        <OfflineBanner />
        {children}
      </div>
      <MobileTabBar pathname={pathname} space={space} />
    </div>
  );
}
