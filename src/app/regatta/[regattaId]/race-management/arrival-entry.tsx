"use client";

import * as React from 'react';
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, Clock, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Heat, CompetitorRaceResult, RegattaParticipant } from '@/lib/types';
import { normalizeArrivals, orderedArrivals, parseArrivalTime } from '@/lib/arrival-order';

type Row = CompetitorRaceResult;
type Props = {
  heat: Heat;
  participants: RegattaParticipant[];
  mode: 'paper' | 'live';
  onMode: (mode: 'paper' | 'live') => void;
  onSave: (rows: Row[]) => Promise<void>;
  onBack: () => void;
  onResults: () => void;
  onValidate: (rows: Row[]) => Promise<void>;
  timer: React.ReactNode;
};

export function ArrivalEntry({ heat, participants, mode, onMode, onSave, onBack, onResults, onValidate, timer }: Props) {
  const [rows, setRows] = React.useState(() => normalizeArrivals(heat.results));
  const current = React.useRef(rows);
  const queue = React.useRef(Promise.resolve());
  const [pending, setPending] = React.useState(0);
  const [saveError, setSaveError] = React.useState(false);
  const [undo, setUndo] = React.useState<Row[] | null>(null);
  const [bib, setBib] = React.useState('');
  const [time, setTime] = React.useState('');
  const [withTime, setWithTime] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [editing, setEditing] = React.useState<string | null>(null);
  const [editPlace, setEditPlace] = React.useState('');
  const [editBib, setEditBib] = React.useState('');
  const [editTime, setEditTime] = React.useState('');
  const [editStatus, setEditStatus] = React.useState<Row['status']>('Finished');
  const [editError, setEditError] = React.useState('');
  const [review, setReview] = React.useState(false);
  const [validating, setValidating] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const list = React.useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = React.useState<{ height: number; top: number } | null>(null);
  React.useEffect(() => {
    // iOS keeps the layout viewport behind the keyboard; use the visible area for this entry screen.
    const visual = window.visualViewport;
    if (!visual) return;
    const resize = () => setViewport({ height: visual.height, top: visual.offsetTop });
    resize();
    visual.addEventListener('resize', resize);
    visual.addEventListener('scroll', resize);
    return () => {
      visual.removeEventListener('resize', resize);
      visual.removeEventListener('scroll', resize);
    };
  }, []);
  const arrivals = orderedArrivals(rows);
  const remaining = [...participants].sort((a, b) => a.bibNumber.localeCompare(b.bibNumber, 'fr', { numeric: true }))
    .filter(person => !arrivals.some(row => row.regattaParticipantId === person.id));

  // Keep input independent of network latency; writes run in the order of the gestures.
  function persist(next: Row[]) {
    setPending(count => count + 1);
    queue.current = queue.current.catch(() => {}).then(() => onSave(next)).then(() => {
      setSaveError(false);
    }).catch(() => { setSaveError(true); }).finally(() => setPending(count => count - 1));
  }
  function commit(next: Row[], remember = true) {
    if (remember) setUndo(current.current);
    current.current = next;
    setRows(next);
    persist(next);
  }
  function add(id?: string) {
    const person = id ? participants.find(p => p.id === id) : participants.find(p => p.bibNumber.replace(/^0+(?=\d)/, '') === bib.trim().replace(/^0+(?=\d)/, ''));
    if (!person) { setError('Ce dossard n’est pas inscrit à cette régate.'); return; }
    const existing = orderedArrivals(current.current).find(row => row.regattaParticipantId === person.id);
    if (existing) { setError(`Dossard ${person.bibNumber} déjà saisi à la place ${existing.arrivalOrder}.`); return; }
    if (mode === 'live' && heat.status !== 'In Progress') { setError('Lance le départ avant de saisir les arrivées en direct.'); return; }
    const finish = mode === 'live' && !withTime ? new Date().toTimeString().slice(0, 8) : parseArrivalTime(time);
    if (finish === undefined || (mode === 'live' && withTime && !finish)) { setError('Heure attendue : 14:32:08 ou 143208.'); return; }
    const position = orderedArrivals(current.current).length + 1;
    const replacement: Row = { regattaParticipantId: person.id, status: 'Finished', arrivalOrder: position, passage: { finish }, rank: null, points: null };
    const others = current.current.filter(row => row.regattaParticipantId !== person.id);
    commit([...others, replacement]);
    setBib(''); setTime(''); setError(''); setMessage(`${position}. Dossard ${person.bibNumber} · ${person.entryName}`);
    requestAnimationFrame(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; });
    if (!id) input.current?.focus();
  }
  function openEditor(id: string) {
    const row = rows.find(item => item.regattaParticipantId === id);
    setEditBib(participants.find(person => person.id === id)?.bibNumber ?? '');
    setEditing(id); setEditPlace(String(row?.arrivalOrder ?? arrivals.length + 1));
    setEditTime(row?.passage.finish ?? ''); setEditStatus(row?.status ?? 'DNS'); setEditError('');
  }
  function saveEdit(remove = false) {
    if (!editing) return;
    const target = remove ? participants.find(person => person.id === editing) : participants.find(person => person.bibNumber.replace(/^0+(?=\d)/, '') === editBib.trim().replace(/^0+(?=\d)/, ''));
    if (!target) { setEditError('Ce dossard n’est pas inscrit à cette régate.'); return; }
    if (target.id !== editing && orderedArrivals(current.current).some(row => row.regattaParticipantId === target.id)) { setEditError('Ce dossard a déjà une arrivée. Corrige sa place depuis sa propre ligne.'); return; }
    const finish = parseArrivalTime(editTime);
    if (!remove && editStatus === 'Finished' && finish === undefined) { setEditError('Heure attendue : 14:32:08 ou 143208.'); return; }
    const others = orderedArrivals(current.current).filter(row => row.regattaParticipantId !== editing);
    const place = Number(editPlace);
    if (!remove && editStatus === 'Finished' && (!Number.isInteger(place) || place < 1 || place > others.length + 1)) { setEditError(`La place doit être comprise entre 1 et ${others.length + 1}.`); return; }
    const replacement: Row = { regattaParticipantId: target.id, status: remove ? 'DNS' : editStatus, passage: { finish: !remove && editStatus === 'Finished' ? finish ?? null : null }, arrivalOrder: null, rank: null, points: null };
    if (!remove && editStatus === 'Finished') others.splice(place - 1, 0, replacement);
    const next = current.current.filter(row => row.regattaParticipantId !== editing && row.regattaParticipantId !== target.id && !others.some(item => item.regattaParticipantId === row.regattaParticipantId));
    if (target.id !== editing) next.push({ regattaParticipantId: editing, status: 'DNS', passage: { finish: null }, arrivalOrder: null, rank: null, points: null });
    if (remove || editStatus !== 'Finished') next.push(replacement);
    commit([...next, ...others.map((row, index) => ({ ...row, arrivalOrder: index + 1 }))]);
    setEditing(null); setMessage(remove ? 'Arrivée retirée. Annulation possible.' : 'Correction enregistrée.');
  }
  const selected = participants.find(person => person.id === editing);
  const locked = pending > 0 || saveError;

  return <section style={viewport ? { height: viewport.height, top: viewport.top, bottom: 'auto' } : undefined} className="fixed inset-0 z-40 flex h-dvh flex-col bg-background pt-[env(safe-area-inset-top)]">
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={onBack} disabled={locked} aria-label="Retour aux manches"><ArrowLeft /></Button>
        <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-bold">{heat.name}</h1><p className="text-xs text-muted-foreground" role="status">{saveError ? 'Échec de sauvegarde' : pending ? 'Enregistrement…' : heat.status === 'Finished' ? 'Résultats validés · corrections possibles' : 'Saisie des arrivées'}</p></div>
        <Button variant="ghost" className="h-11 px-2" disabled={locked || !rows.length} onClick={heat.status === 'Finished' ? onResults : () => setReview(true)}>{heat.status === 'Finished' ? 'Classement' : 'Terminer'}<ArrowUpRight className="ml-1 h-4 w-4" /></Button>
      </header>
      <div className="grid shrink-0 grid-cols-2 gap-1 bg-muted/50 p-2">
        {(['paper', 'live'] as const).map(value => <Button key={value} variant={mode === value ? 'default' : 'ghost'} className="h-11" onClick={() => { onMode(value); setTime(''); setError(''); }}>{value === 'paper' ? 'Reporter la feuille' : 'En direct'}</Button>)}
      </div>
      {mode === 'live' && heat.status !== 'Finished' && <div className="shrink-0 border-b px-3 py-2">{timer}</div>}
      {saveError && <div role="alert" className="flex items-center justify-between gap-2 bg-destructive/10 px-3 py-2 text-sm">Les dernières modifications ne sont pas sauvegardées.<Button variant="outline" onClick={() => persist(current.current)}>Réessayer</Button></div>}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2"><h2 className="text-sm font-semibold">Arrivées <span className="ml-1 text-muted-foreground">{arrivals.length} / {participants.length}</span></h2><Button variant="ghost" className="h-10 gap-2 px-2 text-sm" disabled={!undo} onClick={() => { if (undo) { commit(undo, false); setUndo(null); setMessage('Dernière modification annulée.'); } }}><Undo2 className="h-4 w-4" />Annuler</Button></div>
      <div ref={list} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {!arrivals.length && <div className="px-6 py-8 text-center"><p className="font-medium">{mode === 'paper' ? 'Commence par le premier dossard de la feuille' : 'Les arrivées apparaîtront ici'}</p><p className="mt-2 text-sm text-muted-foreground">{mode === 'paper' ? 'Ajoute les suivants dans le même ordre. Les heures sont facultatives.' : 'Touche un dossard au passage de la ligne.'}</p></div>}
        <ol className="divide-y">{arrivals.map((row, index) => {
          const person = participants.find(item => item.id === row.regattaParticipantId);
          return <li key={row.regattaParticipantId}><button className="flex min-h-14 w-full touch-manipulation items-center gap-3 px-4 py-2 text-left active:bg-muted" onClick={() => openEditor(row.regattaParticipantId)} aria-label={`Modifier la place ${index + 1}, dossard ${person?.bibNumber ?? '?'}`}><span className="w-5 shrink-0 text-sm tabular-nums text-muted-foreground">{index + 1}</span><span className="flex h-10 min-w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 px-2 text-lg font-bold tabular-nums text-primary">{person?.bibNumber ?? '?'}</span><span className="min-w-0 flex-1 truncate font-medium">{person?.entryName ?? 'Coureur indisponible'}</span><span className="shrink-0 text-sm tabular-nums text-muted-foreground">{row.passage.finish ?? '—'}</span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button></li>;
        })}</ol>
        {remaining.length > 0 && <details className="border-t px-4 py-2"><summary className="cursor-pointer py-3 text-sm text-muted-foreground">{remaining.length} concurrent{remaining.length > 1 ? 's' : ''} sans arrivée · statuts</summary><div className="divide-y">{remaining.map(person => <button key={person.id} onClick={() => openEditor(person.id)} className="flex min-h-12 w-full items-center gap-3 text-left text-sm"><span className="w-8 font-bold">{person.bibNumber}</span><span className="min-w-0 flex-1 truncate">{person.entryName}</span><span>{rows.find(row => row.regattaParticipantId === person.id)?.status ?? 'DNS'}</span><ChevronRight className="h-4 w-4" /></button>)}</div></details>}
      </div>
      <div className="shrink-0 border-t bg-background px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <div aria-live="polite" className={`mb-2 min-h-5 truncate text-sm ${error ? 'text-destructive' : 'text-muted-foreground'}`}>{error || message || 'Touche une arrivée pour la corriger.'}</div>
        {mode === 'live' && heat.status !== 'Finished' && <div className="mb-2 grid max-h-32 grid-cols-5 gap-1.5 overflow-y-auto overscroll-contain">{[...participants].sort((a, b) => a.bibNumber.localeCompare(b.bibNumber, 'fr', { numeric: true })).map(person => {
          const done = arrivals.some(row => row.regattaParticipantId === person.id);
          return <Button key={person.id} className="h-11 min-w-0 px-1 text-base tabular-nums" variant="outline" disabled={done || heat.status !== 'In Progress'} onClick={() => add(person.id)} aria-label={`Arrivée du dossard ${person.bibNumber}, ${person.entryName}`}>{done ? <Check className="mr-1 h-3.5 w-3.5 shrink-0" /> : null}<span className="truncate">{person.bibNumber}</span></Button>;
        })}</div>}
        <form onSubmit={event => { event.preventDefault(); add(); }} className="space-y-2">
          <div className="flex items-end gap-2"><label className="min-w-0 flex-1 text-xs font-medium" htmlFor="arrival-bib">Dossard<Input ref={input} id="arrival-bib" inputMode="numeric" autoComplete="off" enterKeyHint="done" value={bib} onChange={event => { setBib(event.target.value); setError(''); }} placeholder="N°" className="mt-1 h-14 text-2xl font-bold" /></label><Button type="submit" className="h-14 shrink-0 px-5 text-base" disabled={!bib.trim() || (mode === 'live' && heat.status !== 'In Progress')}><span>{mode === 'paper' ? 'Ajouter' : 'Arrivée'}</span></Button></div>
          <div className="flex min-h-10 flex-wrap items-center gap-2"><label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={withTime} onChange={event => { setWithTime(event.target.checked); setTime(''); }} className="h-4 w-4 accent-primary" /><Clock className="h-4 w-4" />{mode === 'paper' ? 'Heure sur la feuille' : 'Heure annoncée'}</label>{withTime && <Input aria-label="Heure d’arrivée en format 24 heures" inputMode="numeric" placeholder="HH:MM:SS" value={time} onChange={event => setTime(event.target.value)} className="h-11 w-36 text-base tabular-nums" />}</div>
        </form>
      </div>
    </div>
    <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-xl p-4"><DialogHeader><DialogTitle>Dossard {selected?.bibNumber} · Corriger l’arrivée</DialogTitle><DialogDescription>{selected?.entryName}</DialogDescription></DialogHeader>
      <form onSubmit={event => { event.preventDefault(); saveEdit(); }} className="space-y-4">
        <label className="block space-y-1 text-sm font-medium"><span>Dossard</span><Input inputMode="numeric" value={editBib} onChange={event => setEditBib(event.target.value)} className="h-12 text-base" /></label>
        <label className="block space-y-1 text-sm font-medium"><span>Statut</span><select value={editStatus} onChange={event => setEditStatus(event.target.value as Row['status'])} className="h-12 w-full rounded-md border bg-background px-3 text-base"><option value="Finished">Arrivé</option><option value="DNS">N’a pas pris le départ (DNS)</option><option value="DNF">N’a pas terminé (DNF)</option><option value="PEN">Pénalité</option></select></label>
        {editStatus === 'Finished' && <><label className="block space-y-1 text-sm font-medium"><span>Place dans l’ordre d’arrivée</span><Input inputMode="numeric" value={editPlace} onChange={event => setEditPlace(event.target.value)} className="h-12 text-base" /></label><label className="block space-y-1 text-sm font-medium"><span>Heure d’arrivée · facultative · 24 h</span><Input inputMode="numeric" value={editTime} onChange={event => setEditTime(event.target.value)} placeholder="HH:MM:SS" className="h-12 text-base" /></label></>}
        {editError && <p role="alert" className="text-sm text-destructive">{editError}</p>}
        <Button type="submit" className="h-12 w-full">Enregistrer la correction</Button>
        {arrivals.some(row => row.regattaParticipantId === editing) && <Button type="button" variant="ghost" className="h-11 w-full text-destructive" onClick={() => saveEdit(true)}>Retirer cette arrivée</Button>}
      </form>
    </DialogContent></Dialog>
    <Dialog open={review} onOpenChange={open => { if (!validating) setReview(open); }}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-xl p-4"><DialogHeader><DialogTitle>Vérifier la manche</DialogTitle><DialogDescription>{arrivals.length} arrivées sur {participants.length} inscrits. Vérifie les concurrents sans arrivée avant de calculer les points.</DialogDescription></DialogHeader>
      <div className="space-y-3">{remaining.map(person => <label key={person.id} className="block space-y-1 text-sm"><span className="font-medium">Dossard {person.bibNumber} · {person.entryName}</span><select className="h-12 w-full rounded-md border bg-background px-3 text-base" value={rows.find(row => row.regattaParticipantId === person.id)?.status ?? 'DNS'} onChange={event => {
        const replacement: Row = { regattaParticipantId: person.id, status: event.target.value as Row['status'], arrivalOrder: null, passage: { finish: null }, rank: null, points: null };
        commit([...current.current.filter(row => row.regattaParticipantId !== person.id), replacement]);
      }}><option value="DNS">N’a pas pris le départ (DNS)</option><option value="DNF">N’a pas terminé (DNF)</option><option value="PEN">Pénalité</option></select></label>)}</div>
      <Button className="h-12" disabled={locked || validating} onClick={async () => { setValidating(true); try { await onValidate(current.current); setReview(false); } catch { setError('Le classement n’a pas pu être validé. Réessaie.'); setReview(false); } finally { setValidating(false); } }}>{validating ? 'Validation…' : 'Valider et voir le classement'}</Button>
    </DialogContent></Dialog>
  </section>;
}
