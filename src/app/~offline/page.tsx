"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/layout/page";

// Servie par le service worker quand une page jamais visitée est demandée sans réseau.
export default function OfflinePage() {
  return (
    <Page width="narrow" className="justify-center">
      <section className="surface-ink flex flex-col items-center rounded-[28px] px-6 py-12 text-center shadow-lift">
        <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-signal/15 text-signal">
          <CloudOff className="h-8 w-8" />
        </span>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-signal">Hors ligne</p>
        <h1 className="font-display text-3xl font-extrabold leading-tight">Cette page n’est pas encore sur l’appareil</h1>
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/70">
          Les écrans déjà ouverts restent disponibles et vos saisies sont conservées. Elles partiront dès le retour du réseau.
        </p>
        <Button variant="signal" size="xl" className="mt-7" onClick={() => window.location.reload()}>
          <RefreshCw className="!size-5" />Réessayer
        </Button>
      </section>
    </Page>
  );
}
