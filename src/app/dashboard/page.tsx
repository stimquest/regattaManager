"use client";

import * as React from "react";
import Link from "next/link";
import { collection, type CollectionReference } from "firebase/firestore";
import { ArrowRight, CalendarDays, Flag, Sailboat, Users, Wind } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirestore, useCollection } from "@/firebase";
import type { LandYachtSession, Participant, Regatta } from "@/lib/types";

function localDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

export default function DashboardPage() {
  const firestore = useFirestore();
  const regattasRef = React.useMemo(() => collection(firestore, 'regattas') as CollectionReference<Regatta>, [firestore]);
  const sessionsRef = React.useMemo(() => collection(firestore, 'landYachtSessions') as CollectionReference<LandYachtSession>, [firestore]);
  const participantsRef = React.useMemo(() => collection(firestore, 'participants') as CollectionReference<Participant>, [firestore]);
  const { data: regattas } = useCollection<Regatta>(regattasRef);
  const { data: sessions } = useCollection<LandYachtSession>(sessionsRef);
  const { data: participants } = useCollection<Participant>(participantsRef);

  const upcomingRegatta = [...(regattas ?? [])].filter(event => event.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date))[0];
  const nextSession = [...(sessions ?? [])].filter(session => session.status !== 'finished').sort((a, b) => a.date.localeCompare(b.date))[0];

  return <main className="mx-auto flex w-full max-w-6xl flex-col gap-7 p-4 pb-28 md:p-8">
    <section className="flex flex-col gap-4 rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:flex-row sm:items-end sm:justify-between md:p-9">
      <div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">Espace club</p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Bonjour, comité</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-300 md:text-base">Retrouvez vos régates, vos séances et la base des coureurs au même endroit.</p>
      </div>
      <Badge variant="outline" className="w-fit border-white/20 bg-white/10 px-3 py-1.5 text-white">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</Badge>
    </section>

    <section className="grid gap-3 sm:grid-cols-3">
      <Link href="/"><Card className="h-full rounded-2xl transition-colors hover:border-primary/50"><CardContent className="flex items-center gap-4 p-5"><span className="rounded-xl bg-sky-500/10 p-3 text-sky-600"><Sailboat className="h-6 w-6" /></span><div><p className="text-2xl font-bold tabular-nums">{regattas?.length ?? '—'}</p><p className="text-sm text-muted-foreground">Régates</p></div><ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" /></CardContent></Card></Link>
      <Link href="/land-yachting"><Card className="h-full rounded-2xl transition-colors hover:border-primary/50"><CardContent className="flex items-center gap-4 p-5"><span className="rounded-xl bg-teal-500/10 p-3 text-teal-600"><Wind className="h-6 w-6" /></span><div><p className="text-2xl font-bold tabular-nums">{sessions?.length ?? '—'}</p><p className="text-sm text-muted-foreground">Séances char à voile</p></div><ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" /></CardContent></Card></Link>
      <Link href="/runners"><Card className="h-full rounded-2xl transition-colors hover:border-primary/50"><CardContent className="flex items-center gap-4 p-5"><span className="rounded-xl bg-violet-500/10 p-3 text-violet-600"><Users className="h-6 w-6" /></span><div><p className="text-2xl font-bold tabular-nums">{participants?.length ?? '—'}</p><p className="text-sm text-muted-foreground">Coureurs enregistrés</p></div><ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" /></CardContent></Card></Link>
    </section>

    <section className="grid gap-5 lg:grid-cols-2">
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Sailboat className="h-5 w-5 text-primary" />Régates à la voile</CardTitle><CardDescription className="mt-1">Gestion des inscriptions, manches et classements.</CardDescription></div><Button asChild variant="outline" className="h-11 shrink-0"><Link href="/">Toutes les régates</Link></Button></CardHeader>
        <CardContent>{upcomingRegatta ? <Link href={`/regatta/${upcomingRegatta.id}/race-management`} className="flex min-h-20 items-center gap-3 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted"><CalendarDays className="h-5 w-5 text-primary" /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{upcomingRegatta.name}</p><p className="text-sm text-muted-foreground">{localDate(upcomingRegatta.date)}</p></div><ArrowRight className="h-4 w-4" /></Link> : <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Aucune régate à venir pour le moment.</div>}</CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Wind className="h-5 w-5 text-teal-600" />Char à voile</CardTitle><CardDescription className="mt-1">Séances conviviales et défis du club.</CardDescription></div><Button asChild variant="outline" className="h-11 shrink-0"><Link href="/land-yachting">Voir les séances</Link></Button></CardHeader>
        <CardContent>{nextSession ? <Link href={`/land-yachting/${nextSession.id}`} className="flex min-h-20 items-center gap-3 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted"><Flag className="h-5 w-5 text-teal-600" /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{nextSession.title}</p><p className="text-sm text-muted-foreground">{localDate(nextSession.date)} · {nextSession.status === 'active' ? 'En cours' : 'À venir'}</p></div><ArrowRight className="h-4 w-4" /></Link> : <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Aucune séance prévue pour le moment.</div>}</CardContent>
      </Card>
    </section>

    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div><p className="font-semibold">Accès rapide</p><p className="text-sm text-muted-foreground">Ouvrez l’outil dont vous avez besoin.</p></div>
      <div className="grid grid-cols-2 gap-2 sm:flex"><Button asChild className="h-12"><Link href="/"><Sailboat className="mr-2 h-4 w-4" />Régates</Link></Button><Button asChild variant="secondary" className="h-12"><Link href="/land-yachting"><Wind className="mr-2 h-4 w-4" />Char à voile</Link></Button></div>
    </div>
  </main>;
}
