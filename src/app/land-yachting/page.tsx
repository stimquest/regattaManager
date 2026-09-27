"use client";

import * as React from "react";
import Link from "next/link";
import { addDoc, collection, orderBy, query, type CollectionReference, type Query } from "firebase/firestore";
import { ChevronRight, MapPin, Plus, Sparkles, Wind, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useFirestore, useCollection } from "@/firebase";
import { emitFirestoreError } from "@/firebase/errors";
import type { LandYachtSession } from "@/lib/types";
import { Page, PageHero, HeroStat, SectionHeader, EmptyState, LiveDot, PageLoader } from "@/components/layout/page";
import { DateBlock } from "@/components/date-block";

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const sessionStatus: Record<LandYachtSession['status'], string> = {
  planned: 'À venir',
  active: 'En cours',
  finished: 'Terminée',
};

export default function LandYachtingPage() {
  const firestore = useFirestore();
  const sessionsQuery = React.useMemo(
    () => query(collection(firestore, 'landYachtSessions') as CollectionReference<LandYachtSession>, orderBy('date', 'desc')) as Query<LandYachtSession>,
    [firestore]
  );
  const { data: sessions, loading } = useCollection<LandYachtSession>(sessionsQuery);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [title, setTitle] = React.useState('Séance char à voile');
  const [date, setDate] = React.useState(today());
  const [location, setLocation] = React.useState('');
  const [challenge, setChallenge] = React.useState('Défi du jour');
  const [saving, setSaving] = React.useState(false);

  const createSession = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !date || saving) return;
    setSaving(true);
    try {
      await addDoc(collection(firestore, 'landYachtSessions'), {
        title: title.trim(),
        date,
        location: location.trim(),
        challenge: challenge.trim() || 'Défi du jour',
        status: 'planned',
        createdAt: Date.now(),
      });
      setCreateOpen(false);
      setTitle('Séance char à voile');
      setDate(today());
      setLocation('');
      setChallenge('Défi du jour');
    } catch (error) {
      emitFirestoreError(error, { operation: 'create', path: 'landYachtSessions' });
    } finally {
      setSaving(false);
    }
  };

  const active = (sessions ?? []).filter(session => session.status !== 'finished');
  const done = (sessions ?? []).filter(session => session.status === 'finished');

  const SessionCard = ({ session }: { session: LandYachtSession }) => (
    <Link href={`/land-yachting/${session.id}`} className="pressable group flex items-center gap-4 rounded-3xl border bg-card p-4 shadow-soft hover:border-foreground/15 hover:shadow-lift sm:p-5">
      <DateBlock date={session.date} tone={session.status === 'finished' ? 'muted' : 'teal'} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5">
          <Badge variant={session.status === 'active' ? 'signal' : session.status === 'planned' ? 'success' : 'secondary'}>
            {session.status === 'active' && <LiveDot className="h-2 w-2 [&>span]:h-2 [&>span]:w-2" />}
            {sessionStatus[session.status]}
          </Badge>
        </div>
        <h3 className="truncate font-display text-lg font-bold leading-tight">{session.title}</h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {session.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{session.location}</span>}
          <span className="flex min-w-0 items-center gap-1"><Sparkles className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{session.challenge || 'Défi du jour'}</span></span>
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
    </Link>
  );

  return <Page width="narrow">
    <PageHero
      tone="teal"
      eyebrow="Séances du club"
      title="Char à voile"
      description="Préparez une séance, accueillez les pilotes et lancez un défi convivial."
      actions={<Button variant="sand" size="xl" className="w-full md:w-auto" onClick={() => setCreateOpen(true)}><Plus className="!size-5" />Préparer une séance</Button>}
    >
      <div className="grid grid-cols-2 gap-2 sm:max-w-sm sm:gap-3">
        <HeroStat value={sessions ? active.length : '—'} label="À venir ou en cours" />
        <HeroStat value={sessions ? done.length : '—'} label="Terminées" />
      </div>
    </PageHero>

    {loading ? <PageLoader label="Chargement des séances…" /> :
      !sessions?.length ? <EmptyState icon={Wind} title="Prêts à rouler ?" action={<Button size="lg" className="bg-teal-700 hover:bg-teal-700/90 dark:bg-teal-400 dark:text-teal-950" onClick={() => setCreateOpen(true)}><Plus />Préparer une séance</Button>}>
        Créez une première séance pour noter les pilotes présents, leurs chars et les points du défi du jour.
      </EmptyState> : <div className="space-y-8">
        {active.length > 0 && <section className="space-y-3">
          <SectionHeader title="À venir" />
          <div className="rise-stagger grid grid-cols-1 gap-3">{active.map(session => <SessionCard key={session.id} session={session} />)}</div>
        </section>}
        {done.length > 0 && <section className="space-y-3">
          <SectionHeader title="Terminées" />
          <div className="rise-stagger grid grid-cols-1 gap-3">{done.map(session => <SessionCard key={session.id} session={session} />)}</div>
        </section>}
      </div>}

    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Préparer une séance</DialogTitle><DialogDescription>Vous pourrez tout modifier le jour J.</DialogDescription></DialogHeader>
        <form onSubmit={createSession} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="session-title">Nom de la séance</Label><Input id="session-title" value={title} onChange={e => setTitle(e.target.value)} required maxLength={80} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="session-date">Date</Label><Input id="session-date" type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="session-location">Lieu <span className="font-normal text-muted-foreground">(facultatif)</span></Label><Input id="session-location" value={location} onChange={e => setLocation(e.target.value)} placeholder="Ex. plage du club" maxLength={80} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="session-challenge">Défi du jour</Label><Input id="session-challenge" value={challenge} onChange={e => setChallenge(e.target.value)} placeholder="Ex. slalom, meilleur tour…" maxLength={80} /></div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" size="lg" variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button type="submit" size="lg" disabled={saving || !title.trim()}>{saving ? <><Loader2 className="animate-spin" />Création…</> : 'Créer la séance'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </Page>;
}
