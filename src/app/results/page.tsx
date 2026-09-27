"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Page, PageHero, EmptyState } from "@/components/layout/page";

export default function ResultsPage() {
  return (
    <Page>
      <PageHero eyebrow="Palmarès" title="Résultats" description="Les classements de toutes les régates, réunis ici prochainement." />
      <EmptyState icon={Trophy} title="Bientôt disponible" action={<Button asChild size="lg"><Link href="/regattas">Voir les régates</Link></Button>}>
        En attendant, le classement général de chaque régate est accessible depuis sa page.
      </EmptyState>
    </Page>
  );
}
