"use client";

import * as React from "react";
import Link from "next/link";
import { addDoc, collection, orderBy, query, type CollectionReference, type Query } from "firebase/firestore";
import { CalendarDays, MapPin, Plus, Sparkles, Wind, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useFirestore, useCollection } from "@/firebase";
import { emitFirestoreError } from "@/firebase/errors";
import type { LandYachtSession } from "@/lib/types";

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

  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 pb-28 md:p-8">
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-sky-600 via-cyan-600 to-teal-500 p-6 text-white shadow-lg md:p-9">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <Badge className="mb-4 border-white/25 bg-white/15 text-white hover:bg-white/15">Espace club</Badge>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Char à voile</h1>
          <p className="mt-3 text-base text-white/90 md:text-lg">Préparez une séance, accueillez les pilotes et lancez un défi sympa.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="h-14 w-full rounded-2xl bg-white px-5 text-base font-bold text-sky-800 shadow-sm hover:bg-sky-50 sm:w-auto">
          <Plus className="mr-2 h-5 w-5" /> Préparer une séance
        </Button>
      </div>
    </section>

    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div><h2 className="text-xl font-bold">Les séances</h2><p className="text-sm text-muted-foreground">À venir et passées</p></div>
        {sessions?.length ? <Badge variant="secondary">{sessions.length} séance{sessions.length === 1 ? '' : 's'}</Badge> : null}
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> :
        sessions?.length ? <div className="grid gap-4 md:grid-cols-2">
          {sessions.map(session => <Link key={session.id} href={`/land-yachting/${session.id}`} className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full rounded-2xl transition-colors hover:border-primary/50 hover:bg-accent/30">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div><CardTitle className="text-lg">{session.title}</CardTitle><CardDescription className="mt-2 flex items-center gap-2"><CalendarDays className="h-4 w-4" />{new Date(`${session.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</CardDescription></div>
                  <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>{sessionStatus[session.status]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {session.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{session.location}</span>}
                  <span className="flex items-center gap-1.5"><Sparkles className="h-4 w-4" />{session.challenge || 'Défi du jour'}</span>
                </div>
                <span aria-hidden="true" className="text-lg text-primary">›</span>
              </CardContent>
            </Card>
          </Link>)}
        </div> : <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="mb-4 rounded-full bg-primary/10 p-4 text-primary"><Wind className="h-8 w-8" /></div>
            <h3 className="text-lg font-semibold">Prêts à rouler ?</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">Créez votre première séance pour noter les pilotes présents, leurs chars et les points du défi du jour.</p>
            <Button className="mt-5 h-12" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> Préparer une séance</Button>
          </CardContent>
        </Card>}
    </section>

    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader><DialogTitle>Préparer une séance</DialogTitle></DialogHeader>
        <form onSubmit={createSession} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="session-title">Nom de la séance</Label><Input id="session-title" className="h-12" value={title} onChange={e => setTitle(e.target.value)} required maxLength={80} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="session-date">Date</Label><Input id="session-date" className="h-12" type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="session-location">Lieu (facultatif)</Label><Input id="session-location" className="h-12" value={location} onChange={e => setLocation(e.target.value)} placeholder="Ex. terrain du club" maxLength={80} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="session-challenge">Défi du jour</Label><Input id="session-challenge" className="h-12" value={challenge} onChange={e => setChallenge(e.target.value)} placeholder="Ex. slalom, meilleur tour…" maxLength={80} /></div>
          <DialogFooter className="pt-2"><Button type="submit" className="h-12 w-full sm:w-auto" disabled={saving || !title.trim()}>{saving ? 'Création…' : 'Créer la séance'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </main>;
}
