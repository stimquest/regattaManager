"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { collection, doc, setDoc, updateDoc, type CollectionReference, type DocumentReference } from "firebase/firestore";
import { ArrowLeft, Check, Flag, Loader2, Minus, Plus, Sparkles, Users, Wind } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirestore, useCollection, useDoc } from "@/firebase";
import { emitFirestoreError } from "@/firebase/errors";
import type { LandYachtSession, SessionRider } from "@/lib/types";

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

  if (loadingSession || loadingRiders) return <main className="flex min-h-[60dvh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></main>;
  if (!session) return <main className="mx-auto max-w-3xl p-4 md:p-8"><Link href="/land-yachting"><Button variant="outline" className="h-12"><ArrowLeft className="mr-2 h-4 w-4" />Toutes les séances</Button></Link><p className="mt-8 text-center text-muted-foreground">Cette séance est introuvable.</p></main>;

  const sortedRiders = [...(riders ?? [])].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const presentCount = (riders ?? []).filter(rider => rider.checkedIn).length;
  const nextStatus: LandYachtSession['status'] = session.status === 'planned' ? 'active' : session.status === 'active' ? 'finished' : 'active';
  const statusAction = session.status === 'planned' ? 'Démarrer la séance' : session.status === 'active' ? 'Terminer la séance' : 'Reprendre la séance';

  return <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 pb-28 md:p-8">
    <div className="flex items-center gap-3">
      <Button asChild variant="outline" size="icon" className="h-12 w-12 shrink-0 rounded-xl"><Link href="/land-yachting" aria-label="Retour aux séances"><ArrowLeft className="h-5 w-5" /></Link></Button>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-xl font-bold md:text-2xl">{session.title}</h1><Badge variant={session.status === 'active' ? 'default' : 'secondary'}>{session.status === 'planned' ? 'À venir' : session.status === 'active' ? 'En cours' : 'Terminée'}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{new Date(`${session.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{session.location ? ` · ${session.location}` : ''}</p></div>
    </div>

    <section className="grid grid-cols-2 gap-3">
      <Card className="rounded-2xl"><CardContent className="flex items-center gap-3 p-4"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Users className="h-5 w-5" /></div><div><p className="text-2xl font-bold tabular-nums">{presentCount}<span className="text-base font-medium text-muted-foreground"> / {riders?.length ?? 0}</span></p><p className="text-xs text-muted-foreground">pilotes présents</p></div></CardContent></Card>
      <Card className="rounded-2xl"><CardContent className="flex items-center gap-3 p-4"><div className="rounded-xl bg-amber-500/10 p-3 text-amber-600"><Sparkles className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate font-bold">{session.challenge || 'Défi du jour'}</p><p className="text-xs text-muted-foreground">défi convivial</p></div></CardContent></Card>
    </section>

    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Accueil des pilotes</CardTitle><CardDescription>Ajoutez les personnes au fur et à mesure de leur arrivée.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={addRider} className="space-y-3 rounded-xl bg-muted/50 p-3">
            <div className="space-y-2"><Label htmlFor="rider-name">Nom du pilote</Label><Input id="rider-name" className="h-12" value={name} onChange={e => setName(e.target.value)} placeholder="Prénom et nom" autoComplete="name" required maxLength={80} /></div>
            <div className="space-y-2"><Label htmlFor="yacht-number">Numéro du char <span className="font-normal text-muted-foreground">(facultatif)</span></Label><Input id="yacht-number" className="h-12" value={yachtNumber} onChange={e => setYachtNumber(e.target.value)} placeholder="Ex. 42" maxLength={12} /></div>
            <Button type="submit" className="h-12 w-full text-base" disabled={!name.trim() || busy}><Plus className="mr-2 h-5 w-5" />{busy ? 'Ajout…' : 'Ajouter comme présent'}</Button>
          </form>

          <div className="space-y-2">
            {(riders ?? []).length === 0 ? <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground"><Wind className="mx-auto mb-2 h-6 w-6" />Les pilotes présents apparaîtront ici.</div> :
              [...(riders ?? [])].sort((a, b) => Number(b.checkedIn) - Number(a.checkedIn) || a.name.localeCompare(b.name)).map(rider => <div key={rider.id} className="flex min-h-[72px] items-center gap-3 rounded-xl border p-3">
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{rider.name}</p><p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">{rider.yachtNumber ? <><Flag className="h-3.5 w-3.5" /> Char {rider.yachtNumber}</> : 'Char à attribuer'}</p></div>
                <Button type="button" variant={rider.checkedIn ? 'default' : 'outline'} className="h-12 shrink-0 rounded-xl px-3" onClick={() => updateRider(rider, { checkedIn: !rider.checkedIn })} aria-label={`${rider.checkedIn ? 'Marquer absent' : 'Marquer présent'} : ${rider.name}`}>
                  <Check className="mr-1.5 h-4 w-4" />{rider.checkedIn ? 'Présent' : 'Absent'}
                </Button>
              </div>)}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500" />Défi du jour</CardTitle><CardDescription>Un petit classement pour le plaisir, sans règles de compétition officielles.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2"><Input aria-label="Nom du défi" className="h-12 text-base" value={challenge} onChange={e => setChallenge(e.target.value)} maxLength={80} /><Button className="h-12 shrink-0" variant="outline" onClick={saveChallenge} disabled={savingChallenge || challenge.trim() === (session.challenge || 'Défi du jour')}>{savingChallenge ? '…' : 'Enregistrer'}</Button></div>
            {sortedRiders.filter(r => r.checkedIn).length === 0 ? <p className="rounded-xl bg-muted/50 p-4 text-center text-sm text-muted-foreground">Ajoutez des pilotes présents pour commencer le défi.</p> :
              <ol className="space-y-2">
                {sortedRiders.filter(r => r.checkedIn).map((rider, index) => <li key={rider.id} className="flex min-h-[68px] items-center gap-3 rounded-xl border p-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${index === 0 ? 'bg-amber-400/20 text-amber-700 dark:text-amber-300' : 'bg-muted text-muted-foreground'}`}>{index + 1}</span>
                  <div className="min-w-0 flex-1"><p className="truncate font-semibold">{rider.name}</p><p className="text-xs text-muted-foreground">{rider.yachtNumber ? `Char ${rider.yachtNumber}` : 'Sans numéro'}</p></div>
                  <div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={() => updateRider(rider, { points: Math.max(0, rider.points - 1) })} aria-label={`Enlever un point à ${rider.name}`} disabled={rider.points <= 0}><Minus className="h-4 w-4" /></Button><span className="w-8 text-center text-xl font-bold tabular-nums">{rider.points}</span><Button type="button" size="icon" className="h-11 w-11 rounded-xl" onClick={() => updateRider(rider, { points: rider.points + 1 })} aria-label={`Ajouter un point à ${rider.name}`}><Plus className="h-4 w-4" /></Button></div>
                </li>)}
              </ol>}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-semibold">{session.status === 'active' ? 'La séance est lancée' : session.status === 'finished' ? 'Séance terminée' : 'Prêt à commencer ?'}</p><p className="text-sm text-muted-foreground">{session.status === 'active' ? 'Les présences et les points restent modifiables.' : 'Vous pourrez toujours corriger les présences et les points.'}</p></div>
            <Button className="h-12 shrink-0" variant={session.status === 'active' ? 'outline' : 'default'} onClick={() => changeStatus(nextStatus)}><Flag className="mr-2 h-4 w-4" />{statusAction}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  </main>;
}
