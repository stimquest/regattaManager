"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { collection, doc, setDoc, updateDoc, type CollectionReference, type DocumentReference } from "firebase/firestore";
import { Check, Loader2, MapPin, Minus, Play, Plus, Sparkles, Square, Users, Wind } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFirestore, useCollection, useDoc } from "@/firebase";
import { emitFirestoreError } from "@/firebase/errors";
import type { LandYachtSession, SessionRider } from "@/lib/types";
import { Page, DetailHeader, HeroStat, SectionHeader, EmptyState, LiveDot, PageLoader, RankBadge } from "@/components/layout/page";
import { cn } from "@/lib/utils";

export default function LandYachtSessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const firestore = useFirestore();
  const sessionRef = React.useMemo(() => sessionId ? doc(firestore, 'landYachtSessions', sessionId) as DocumentReference<LandYachtSession> : null, [firestore, sessionId]);
  const ridersCollection = React.useMemo(() => sessionId ? collection(firestore, 'landYachtSessions', sessionId, 'riders') as CollectionReference<SessionRider> : null, [firestore, sessionId]);
  const { data: session, loading: loadingSession } = useDoc<LandYachtSession>(sessionRef);
  const { data: riders, loading: loadingRiders } = useCollection<SessionRider>(ridersCollection);
  const [name, setName] = React.useState('');
  const [yachtNumber, setYachtNumber] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [challenge, setChallenge] = React.useState('');
  const [savingChallenge, setSavingChallenge] = React.useState(false);

  React.useEffect(() => setChallenge(session?.challenge ?? ''), [session?.id, session?.challenge]);

  const addRider = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ridersCollection || !name.trim() || busy) return;
    setBusy(true);
    try {
      const riderRef = doc(ridersCollection);
      await setDoc(riderRef, { id: riderRef.id, name: name.trim(), yachtNumber: yachtNumber.trim(), checkedIn: true, points: 0, createdAt: Date.now() });
      setName('');
      setYachtNumber('');
    } catch (error) {
      emitFirestoreError(error, { operation: 'create', path: ridersCollection.path });
    } finally {
      setBusy(false);
    }
  };

  const updateRider = async (rider: SessionRider, patch: Partial<SessionRider>) => {
    if (!sessionId) return;
    try {
      await updateDoc(doc(firestore, 'landYachtSessions', sessionId, 'riders', rider.id), patch);
    } catch (error) {
      emitFirestoreError(error, { operation: 'update', path: `landYachtSessions/${sessionId}/riders/${rider.id}`, requestResourceData: patch });
    }
  };

  const changeStatus = async (status: LandYachtSession['status']) => {
    if (!sessionRef) return;
    try {
      await updateDoc(sessionRef, { status });
    } catch (error) {
      emitFirestoreError(error, { operation: 'update', path: sessionRef.path, requestResourceData: { status } });
    }
  };

  const saveChallenge = async () => {
    if (!sessionRef || savingChallenge) return;
    setSavingChallenge(true);
    try {
      await updateDoc(sessionRef, { challenge: challenge.trim() || 'Défi du jour' });
    } catch (error) {
      emitFirestoreError(error, { operation: 'update', path: sessionRef.path, requestResourceData: { challenge } });
    } finally {
      setSavingChallenge(false);
    }
  };

  if (loadingSession || loadingRiders) return <PageLoader label="Chargement de la séance…" />;
  if (!session) return <Page width="narrow"><DetailHeader tone="teal" backHref="/land-yachting" backLabel="Toutes les séances" title="Séance introuvable" /><EmptyState icon={Wind} title="Cette séance n’existe plus">Elle a peut-être été supprimée depuis un autre appareil.</EmptyState></Page>;

  const sortedRiders = [...(riders ?? [])].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const presentCount = (riders ?? []).filter(rider => rider.checkedIn).length;
  const nextStatus: LandYachtSession['status'] = session.status === 'planned' ? 'active' : session.status === 'active' ? 'finished' : 'active';
  const statusAction = session.status === 'planned' ? 'Démarrer' : session.status === 'active' ? 'Terminer' : 'Reprendre';
  const leaderboard = sortedRiders.filter(r => r.checkedIn);

  return <Page width="narrow">
    <DetailHeader
      tone="teal"
      backHref="/land-yachting"
      backLabel="Toutes les séances"
      eyebrow={session.status === 'active' ? <span className="flex items-center gap-2"><LiveDot />Séance en cours</span> : session.status === 'planned' ? 'À venir' : 'Terminée'}
      title={session.title}
      meta={<><span className="first-letter:uppercase">{new Date(`${session.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>{session.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{session.location}</span>}</>}
    />

    <section className="surface-teal flex flex-col gap-4 rounded-[28px] p-5 shadow-lift sm:flex-row sm:items-center sm:p-6">
      <div className="grid flex-1 grid-cols-2 gap-2 sm:gap-3">
        <HeroStat value={<>{presentCount}<span className="text-lg text-white/50"> / {riders?.length ?? 0}</span></>} label="Pilotes présents" />
        <HeroStat value={leaderboard[0]?.points ?? 0} label={leaderboard[0] ? `Meilleur score · ${leaderboard[0].name}` : 'Meilleur score'} />
      </div>
      <Button variant={session.status === 'active' ? 'ink' : 'sand'} size="xl" className={cn("sm:w-44", session.status === 'active' && "border border-white/15 bg-white/10 text-white hover:bg-white/15")} onClick={() => changeStatus(nextStatus)}>
        {session.status === 'active' ? <Square className="!size-4 fill-current" /> : <Play className="!size-5 fill-current" />}{statusAction}
      </Button>
    </section>

    <section className="space-y-3">
      <SectionHeader title="Accueil des pilotes" description="Ajoutez chacun à son arrivée sur le terrain." />
      <form onSubmit={addRider} className="flex flex-col gap-2 rounded-3xl border bg-card p-3 shadow-soft sm:flex-row">
        <Input aria-label="Nom du pilote" className="sm:flex-1" value={name} onChange={e => setName(e.target.value)} placeholder="Prénom et nom" autoComplete="name" autoCapitalize="words" enterKeyHint="next" required maxLength={80} />
        <div className="flex gap-2">
          <Input aria-label="Numéro du char (facultatif)" className="w-28 tabular-nums" inputMode="numeric" value={yachtNumber} onChange={e => setYachtNumber(e.target.value)} placeholder="N° char" maxLength={12} />
          <Button type="submit" size="lg" className="h-12 flex-1 sm:flex-none" disabled={!name.trim() || busy}>{busy ? <Loader2 className="animate-spin" /> : <Plus />}Présent</Button>
        </div>
      </form>

      {(riders ?? []).length === 0 ? <EmptyState icon={Users} title="Personne pour l’instant">Les pilotes présents apparaîtront ici.</EmptyState> :
        <ul className="divide-y overflow-hidden rounded-3xl border bg-card shadow-soft">
          {[...(riders ?? [])].sort((a, b) => Number(b.checkedIn) - Number(a.checkedIn) || a.name.localeCompare(b.name)).map(rider => <li key={rider.id} className="flex min-h-[68px] items-center gap-3 px-4 py-2">
            {rider.yachtNumber ? <span className="bib h-9 min-w-10 text-base">{rider.yachtNumber}</span> : <span className="flex h-9 min-w-10 items-center justify-center rounded-[0.625rem] border border-dashed text-muted-foreground"><Wind className="h-4 w-4" /></span>}
            <div className="min-w-0 flex-1"><p className={cn("truncate font-semibold", !rider.checkedIn && "text-muted-foreground")}>{rider.name}</p><p className="text-[13px] text-muted-foreground">{rider.yachtNumber ? `Char ${rider.yachtNumber}` : 'Char à attribuer'}</p></div>
            <button type="button" role="switch" aria-checked={rider.checkedIn} onClick={() => updateRider(rider, { checkedIn: !rider.checkedIn })} aria-label={`${rider.checkedIn ? 'Marquer absent' : 'Marquer présent'} : ${rider.name}`}
              className={cn("press-feedback flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold", rider.checkedIn ? "bg-success/12 text-success" : "bg-muted text-muted-foreground")}>
              {rider.checkedIn ? <Check className="h-4 w-4" strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-current opacity-50" />}
              {rider.checkedIn ? 'Présent' : 'Absent'}
            </button>
          </li>)}
        </ul>}
    </section>

    <section className="space-y-3">
      <SectionHeader title="Défi du jour" description="Un classement pour le plaisir, sans règles officielles." />
      <div className="flex gap-2">
        <div className="relative flex-1"><Sparkles className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" /><Input aria-label="Nom du défi" className="pl-11" value={challenge} onChange={e => setChallenge(e.target.value)} maxLength={80} /></div>
        <Button className="h-12 shrink-0" variant="outline" onClick={saveChallenge} disabled={savingChallenge || challenge.trim() === (session.challenge || 'Défi du jour')}>{savingChallenge ? <Loader2 className="animate-spin" /> : 'Renommer'}</Button>
      </div>
      {leaderboard.length === 0 ? <p className="rounded-3xl border border-dashed p-6 text-center text-sm text-muted-foreground">Ajoutez des pilotes présents pour lancer le défi.</p> :
        <ol className="divide-y overflow-hidden rounded-3xl border bg-card shadow-soft">
          {leaderboard.map((rider, index) => <li key={rider.id} className="flex min-h-[72px] items-center gap-3 px-4 py-2">
            <RankBadge rank={rider.points > 0 ? index + 1 : null} />
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{rider.name}</p><p className="text-[13px] text-muted-foreground">{rider.yachtNumber ? `Char ${rider.yachtNumber}` : 'Sans numéro'}</p></div>
            <div className="flex items-center gap-1.5">
              <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => updateRider(rider, { points: Math.max(0, rider.points - 1) })} aria-label={`Enlever un point à ${rider.name}`} disabled={rider.points <= 0}><Minus /></Button>
              <span className="w-9 text-center font-display text-2xl font-extrabold tabular-nums">{rider.points}</span>
              <Button type="button" size="icon" className="rounded-full" onClick={() => updateRider(rider, { points: rider.points + 1 })} aria-label={`Ajouter un point à ${rider.name}`}><Plus /></Button>
            </div>
          </li>)}
        </ol>}
    </section>
  </Page>;
}
