"use client";

import * as React from 'react';
import { ArrowLeft, Check, ChevronRight, Clock, CornerDownLeft, FileText, Radio, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Heat, CompetitorRaceResult, RegattaParticipant } from '@/lib/types';
import { cn } from '@/lib/utils';
import { contradictsTime, normalizeArrivals, orderedArrivals, parseArrivalTime, placeForTime, timeBounds } from '@/lib/arrival-order';

type Row = CompetitorRaceResult;

/** « 1ʳᵉ », « 2ᵉ »… pour parler d'une place. */
const nth = (place: number) => (place === 1 ? '1ʳᵉ' : `${place}ᵉ`);
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
  const [editPlaceInitial, setEditPlaceInitial] = React.useState('');
  const [editConflict, setEditConflict] = React.useState<{ place: number; before: string | null; after: string | null; suggested: number } | null>(null);
  const [review, setReview] = React.useState(false);
  const [validating, setValidating] = React.useState(false);
  const [justAdded, setJustAdded] = React.useState<string | null>(null);
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
    // Une heure connue range l'arrivée : une heure annoncée en retard par radio retrouve sa vraie place.
    const ordered = orderedArrivals(current.current);
    const index = finish ? placeForTime(ordered, ordered.length, finish) : ordered.length;
    const appended = index === ordered.length;
    ordered.splice(index, 0, { regattaParticipantId: person.id, status: 'Finished', arrivalOrder: null, passage: { finish }, rank: null, points: null });
    const unplaced = current.current.filter(row => !ordered.some(item => item.regattaParticipantId === row.regattaParticipantId));
    commit([...unplaced, ...ordered.map((row, order) => ({ ...row, arrivalOrder: order + 1 }))]);
    setBib(''); setTime(''); setError(''); setJustAdded(person.id);
    setMessage(`${nth(index + 1)}${appended ? '' : ' d’après l’heure'} · dossard ${person.bibNumber} · ${person.entryName}`);
    reveal(person.id, appended);
    if (!id) input.current?.focus();
  }
  function reveal(id: string, toBottom: boolean) {
    requestAnimationFrame(() => {
      if (toBottom && list.current) list.current.scrollTop = list.current.scrollHeight;
      else list.current?.querySelector(`[data-row="${id}"]`)?.scrollIntoView({ block: 'nearest' });
    });
  }
  function openEditor(id: string) {
    const row = rows.find(item => item.regattaParticipantId === id);
    const place = String(row?.status === 'Finished' && row.arrivalOrder != null ? row.arrivalOrder : arrivals.length + 1);
    setEditBib(participants.find(person => person.id === id)?.bibNumber ?? '');
    setEditing(id); setEditPlace(place); setEditPlaceInitial(place);
    setEditTime(row?.passage.finish ?? ''); setEditStatus(row?.status ?? 'DNS'); setEditError(''); setEditConflict(null);
  }
  /** `override` : choix fait dans l'alerte de cohérence (heure inconnue, ou place déduite de l'heure). */
  function saveEdit(remove = false, override: { unknownTime?: boolean; place?: number } = {}) {
    if (!editing) return;
    const target = remove ? participants.find(person => person.id === editing) : participants.find(person => person.bibNumber.replace(/^0+(?=\d)/, '') === editBib.trim().replace(/^0+(?=\d)/, ''));
    if (!target) { setEditError('Ce dossard n’est pas inscrit à cette régate.'); return; }
    if (target.id !== editing && orderedArrivals(current.current).some(row => row.regattaParticipantId === target.id)) { setEditError('Ce dossard a déjà une arrivée. Corrige sa place depuis sa propre ligne.'); return; }
    const finish = override.unknownTime ? null : parseArrivalTime(editTime);
    if (!remove && editStatus === 'Finished' && finish === undefined) { setEditError('Heure attendue : 14:32:08 ou 143208.'); return; }
    const others = orderedArrivals(current.current).filter(row => row.regattaParticipantId !== editing);
    const place = override.place ?? Number(editPlace);
    if (!remove && editStatus === 'Finished' && (!Number.isInteger(place) || place < 1 || place > others.length + 1)) { setEditError(`La place doit être comprise entre 1 et ${others.length + 1}.`); return; }
    let index = place - 1;
    let movedByTime = false;
    if (!remove && editStatus === 'Finished' && finish) {
      const placeImposed = override.place != null || editPlace.trim() !== editPlaceInitial;
      if (!placeImposed) {
        // Seule l'heure a changé : elle décide de la place.
        const fitted = placeForTime(others, index, finish);
        movedByTime = fitted !== index;
        index = fitted;
      } else if (contradictsTime(others, index, finish)) {
        // La place saisie contredit l'heure : on demande laquelle croire.
        setEditConflict({ place, ...timeBounds(others, index), suggested: placeForTime(others, index, finish) + 1 });
        return;
      }
    }
    const replacement: Row = { regattaParticipantId: target.id, status: remove ? 'DNS' : editStatus, passage: { finish: !remove && editStatus === 'Finished' ? finish ?? null : null }, arrivalOrder: null, rank: null, points: null };
    if (!remove && editStatus === 'Finished') others.splice(index, 0, replacement);
    const next = current.current.filter(row => row.regattaParticipantId !== editing && row.regattaParticipantId !== target.id && !others.some(item => item.regattaParticipantId === row.regattaParticipantId));
    if (target.id !== editing) next.push({ regattaParticipantId: editing, status: 'DNS', passage: { finish: null }, arrivalOrder: null, rank: null, points: null });
    if (remove || editStatus !== 'Finished') next.push(replacement);
    commit([...next, ...others.map((row, index) => ({ ...row, arrivalOrder: index + 1 }))]);
    setEditing(null); setEditConflict(null);
    setMessage(remove ? 'Arrivée retirée. Annulation possible.' : movedByTime ? `Correction enregistrée · ${nth(index + 1)} place d’après l’heure.` : override.unknownTime ? `Correction enregistrée · ${nth(index + 1)} place, heure inconnue.` : 'Correction enregistrée.');
    if (!remove && editStatus === 'Finished') { setJustAdded(target.id); reveal(target.id, false); }
  }
  const selected = participants.find(person => person.id === editing);
  const locked = pending > 0 || saveError;
  const progress = participants.length ? Math.round((arrivals.length / participants.length) * 100) : 0;
  const sortedParticipants = [...participants].sort((a, b) => a.bibNumber.localeCompare(b.bibNumber, 'fr', { numeric: true }));
  const statusChoices: [Row['status'], string][] = [['Finished', 'Arrivé'], ['DNS', 'DNS'], ['DNF', 'DNF'], ['PEN', 'Pénalité']];

  return <section style={viewport ? { height: viewport.height, top: viewport.top, bottom: 'auto' } : undefined} className="fixed inset-0 z-[45] flex h-dvh flex-col bg-background pt-[env(safe-area-inset-top)]">
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-3">
        <button type="button" onClick={onBack} disabled={locked} aria-label="Retour aux manches" className="press-feedback flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-card shadow-soft disabled:opacity-40"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1 px-1">
          <h1 className="truncate font-display text-xl font-extrabold leading-tight">{heat.name}</h1>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground" role="status">
            <span className={cn("h-1.5 w-1.5 rounded-full", saveError ? "bg-destructive" : pending ? "animate-pulse bg-signal" : "bg-success")} />
            {saveError ? 'Échec de sauvegarde' : pending ? 'Enregistrement…' : heat.status === 'Finished' ? 'Validée · corrections possibles' : 'Enregistré'}
          </p>
        </div>
        <Button variant={heat.status === 'Finished' ? 'outline' : 'default'} className="rounded-full px-4" disabled={locked || !rows.length} onClick={heat.status === 'Finished' ? onResults : () => setReview(true)}>
          {heat.status === 'Finished' ? 'Classement' : 'Terminer'}<ChevronRight />
        </Button>
      </header>

      <div className="shrink-0 space-y-2 px-3 pb-2">
        <div role="tablist" aria-label="Mode de saisie" className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
          {(['paper', 'live'] as const).map(value => {
            const active = mode === value;
            const Icon = value === 'paper' ? FileText : Radio;
            return <button key={value} type="button" role="tab" aria-selected={active} onClick={() => { onMode(value); setTime(''); setError(''); }}
              className={cn("flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-[color,background-color,box-shadow] duration-150 ease-out", active ? "bg-card text-foreground shadow-soft" : "text-muted-foreground")}>
              <Icon className="h-4 w-4" />{value === 'paper' ? 'Feuille papier' : 'En direct'}
            </button>;
          })}
        </div>
        {mode === 'live' && heat.status !== 'Finished' && timer}
        {saveError && <div role="alert" className="flex items-center justify-between gap-2 rounded-2xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">Modifications non sauvegardées.<Button size="sm" variant="outline" onClick={() => persist(current.current)}>Réessayer</Button></div>}
      </div>

      <div className="flex shrink-0 items-center gap-3 border-y bg-card/60 px-4 py-2">
        <h2 className="text-sm font-semibold">Arrivées</h2>
        <span className="font-display text-sm font-bold tabular-nums">{arrivals.length}<span className="text-muted-foreground">/{participants.length}</span></span>
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true"><span className="block h-full rounded-full bg-signal transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} /></span>
        <Button variant="ghost" size="sm" className="-mr-2 gap-1.5" disabled={!undo} onClick={() => { if (undo) { commit(undo, false); setUndo(null); setJustAdded(null); setMessage('Dernière modification annulée.'); } }}><Undo2 />Annuler</Button>
      </div>

      <div ref={list} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {!arrivals.length && <div className="flex flex-col items-center px-8 py-10 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">{mode === 'paper' ? <FileText className="h-6 w-6" /> : <Radio className="h-6 w-6" />}</span>
          <p className="font-display text-lg font-bold">{mode === 'paper' ? 'Premier dossard de la feuille' : 'En attente des arrivées'}</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">{mode === 'paper' ? 'Tapez les suivants dans le même ordre. Les heures sont facultatives.' : 'Touchez un dossard au passage de la ligne.'}</p>
        </div>}
        <ol className="divide-y">{arrivals.map((row, index) => {
          const person = participants.find(item => item.id === row.regattaParticipantId);
          const fresh = justAdded === row.regattaParticipantId;
          return <li key={row.regattaParticipantId} data-row={row.regattaParticipantId} className={cn(fresh && "animate-rise bg-signal/[0.06]")}>
            <button className="flex min-h-[60px] w-full touch-manipulation items-center gap-3 px-4 py-2 text-left transition-colors duration-100 active:bg-muted" onClick={() => openEditor(row.regattaParticipantId)} aria-label={`Modifier la place ${index + 1}, dossard ${person?.bibNumber ?? '?'}`}>
              <span className="w-7 shrink-0 text-right font-display text-base font-bold tabular-nums text-muted-foreground">{index + 1}</span>
              <span className="bib">{person?.bibNumber ?? '?'}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{person?.entryName ?? 'Coureur indisponible'}</span>
              {row.passage.finish ? <span className="shrink-0 rounded-lg bg-muted px-2 py-1 text-xs font-semibold tabular-nums">{row.passage.finish}</span> : null}
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
            </button>
          </li>;
        })}</ol>
        {remaining.length > 0 && <details className="group border-t">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
            <span>{remaining.length} sans arrivée · statuts</span><ChevronRight className="h-4 w-4 transition-transform duration-200 ease-out group-open:rotate-90" />
          </summary>
          <div className="divide-y border-t">{remaining.map(person => {
            const status = rows.find(row => row.regattaParticipantId === person.id)?.status ?? 'DNS';
            return <button key={person.id} onClick={() => openEditor(person.id)} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left text-sm active:bg-muted">
              <span className="bib h-8 min-w-9 text-sm opacity-70">{person.bibNumber}</span>
              <span className="min-w-0 flex-1 truncate">{person.entryName}</span>
              <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-bold", status === 'Finished' ? "text-muted-foreground" : "bg-destructive/10 text-destructive")}>{status}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
            </button>;
          })}</div>
        </details>}
      </div>

      <div className="shrink-0 rounded-t-[28px] bg-card px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-bar">
        <div aria-live="polite" className={cn("mb-2 min-h-5 truncate px-1 text-sm font-medium", error ? "text-destructive" : message ? "text-foreground" : "text-muted-foreground")}>{error || message || 'Touchez une arrivée pour la corriger.'}</div>
        {mode === 'live' && heat.status !== 'Finished' && <div className="no-scrollbar mb-3 grid max-h-[7.5rem] grid-cols-5 gap-1.5 overflow-y-auto overscroll-contain sm:grid-cols-8">{sortedParticipants.map(person => {
          const done = arrivals.some(row => row.regattaParticipantId === person.id);
          return <button key={person.id} type="button" className={cn("press-feedback relative flex h-12 min-w-0 items-center justify-center rounded-xl font-display text-lg font-bold tabular-nums", done ? "bg-muted text-muted-foreground/60" : "bg-ink text-ink-foreground shadow-[inset_0_-2px_0_rgba(0,0,0,0.25)] dark:bg-ink-foreground dark:text-ink")} disabled={done || heat.status !== 'In Progress'} onClick={() => add(person.id)} aria-label={`Arrivée du dossard ${person.bibNumber}, ${person.entryName}`}>
            {done && <Check className="absolute right-1 top-1 h-3 w-3" strokeWidth={3} />}<span className="truncate px-1">{person.bibNumber}</span>
          </button>;
        })}</div>}
        <form onSubmit={event => { event.preventDefault(); add(); }} className="space-y-2">
          <div className="flex gap-2">
            <label className="relative min-w-0 flex-1" htmlFor="arrival-bib">
              <span className="pointer-events-none absolute left-4 top-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Dossard</span>
              <Input ref={input} id="arrival-bib" inputMode="numeric" autoComplete="off" enterKeyHint="done" value={bib} onChange={event => { setBib(event.target.value); setError(''); }} placeholder="—" className="h-16 rounded-2xl pb-1 pl-4 pt-5 font-display text-3xl font-extrabold tabular-nums placeholder:text-muted-foreground/40" />
            </label>
            <Button type="submit" size="xl" variant={mode === 'live' ? 'signal' : 'default'} className="h-16 shrink-0 rounded-2xl px-6 text-base" disabled={!bib.trim() || (mode === 'live' && heat.status !== 'In Progress')}>
              {mode === 'paper' ? 'Ajouter' : 'Arrivée'}<CornerDownLeft className="!size-5 opacity-70" />
            </Button>
          </div>
          <div className="flex min-h-11 items-center gap-2">
            <button type="button" aria-pressed={withTime} onClick={() => { setWithTime(!withTime); setTime(''); }} className={cn("press-feedback flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold", withTime ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>
              <Clock className="h-4 w-4" />{mode === 'paper' ? 'Heure notée' : 'Heure annoncée'}
            </button>
            {withTime && <Input aria-label="Heure d’arrivée en format 24 heures" inputMode="numeric" placeholder="HH:MM:SS" value={time} onChange={event => setTime(event.target.value)} className="h-10 w-32 rounded-full text-center font-semibold tabular-nums" />}
          </div>
        </form>
      </div>
    </div>

    <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null); }}><DialogContent>
      <DialogHeader>
        <div className="flex items-center gap-3"><span className="bib h-12 min-w-14 text-2xl">{selected?.bibNumber}</span><div className="min-w-0"><DialogTitle>Corriger l’arrivée</DialogTitle><DialogDescription className="truncate">{selected?.entryName}</DialogDescription></div></div>
      </DialogHeader>
      <form onSubmit={event => { event.preventDefault(); saveEdit(); }} className="space-y-4">
        <div className="space-y-2">
          <span className="text-sm font-semibold">Statut</span>
          <div role="radiogroup" className="grid grid-cols-4 gap-1.5">{statusChoices.map(([value, label]) => {
            const active = editStatus === value;
            return <button key={value} type="button" role="radio" aria-checked={active} onClick={() => setEditStatus(value)} className={cn("press-feedback h-11 rounded-xl border-2 text-sm font-bold", active ? (value === 'Finished' ? "border-primary bg-primary/[0.06] text-primary" : "border-destructive bg-destructive/[0.06] text-destructive") : "border-border bg-card text-muted-foreground")}>{label}</button>;
          })}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-2 text-sm font-semibold"><span>Dossard</span><Input inputMode="numeric" value={editBib} onChange={event => setEditBib(event.target.value)} className="font-display text-lg font-bold tabular-nums" /></label>
          {editStatus === 'Finished' && <label className="block space-y-2 text-sm font-semibold"><span>Place</span><Input inputMode="numeric" value={editPlace} onChange={event => { setEditPlace(event.target.value); setEditConflict(null); }} className="font-display text-lg font-bold tabular-nums" /></label>}
        </div>
        {editStatus === 'Finished' && <div className="space-y-2">
          <label htmlFor="edit-time" className="block text-sm font-semibold">Heure d’arrivée <span className="font-normal text-muted-foreground">· 24 h</span></label>
          <div className="flex gap-2">
            <Input id="edit-time" inputMode="numeric" value={editTime} onChange={event => { setEditTime(event.target.value); setEditConflict(null); }} placeholder="Inconnue" className="tabular-nums" />
            {editTime && <Button type="button" variant="outline" className="h-12 shrink-0" onClick={() => { setEditTime(''); setEditConflict(null); }}>Inconnue</Button>}
          </div>
          <p className="text-xs text-muted-foreground">Heure connue : elle fixe la place. Heure inconnue : la place saisie fait foi.</p>
        </div>}
        {editConflict && <div role="alert" className="space-y-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5">
          <p className="text-sm font-medium leading-snug">
            À la {nth(editConflict.place)} place, l’heure devrait être {editConflict.before && editConflict.after ? <>entre <b className="tabular-nums">{editConflict.before}</b> et <b className="tabular-nums">{editConflict.after}</b></> : editConflict.before ? <>après <b className="tabular-nums">{editConflict.before}</b></> : <>avant <b className="tabular-nums">{editConflict.after}</b></>}. Corrigez l’heure, ou choisissez :
          </p>
          <div className="grid gap-2">
            <Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal py-2" onClick={() => saveEdit(false, { unknownTime: true })}>Garder la {nth(editConflict.place)} place · heure inconnue</Button>
            <Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal py-2" onClick={() => saveEdit(false, { place: editConflict.suggested })}>Garder l’heure · passer à la {nth(editConflict.suggested)} place</Button>
          </div>
        </div>}
        {editError && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{editError}</p>}
        <div className="space-y-2 pt-1">
          <Button type="submit" size="lg" className="w-full">Enregistrer la correction</Button>
          {arrivals.some(row => row.regattaParticipantId === editing) && <Button type="button" variant="ghost" size="lg" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => saveEdit(true)}>Retirer cette arrivée</Button>}
        </div>
      </form>
    </DialogContent></Dialog>

    <Dialog open={review} onOpenChange={open => { if (!validating) setReview(open); }}><DialogContent>
      <DialogHeader>
        <DialogTitle>Vérifier la manche</DialogTitle>
        <DialogDescription>{arrivals.length} arrivée{arrivals.length > 1 ? 's' : ''} sur {participants.length} inscrits.{remaining.length ? ' Indiquez le statut des concurrents sans arrivée avant de calculer les points.' : ' Tout le monde est arrivé.'}</DialogDescription>
      </DialogHeader>
      {remaining.length > 0 && <ul className="divide-y overflow-hidden rounded-2xl border">{remaining.map(person => <li key={person.id} className="flex items-center gap-3 px-3 py-2">
        <span className="bib h-9 min-w-10 text-base">{person.bibNumber}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{person.entryName}</span>
        <Select value={rows.find(row => row.regattaParticipantId === person.id)?.status ?? 'DNS'} onValueChange={value => {
          const replacement: Row = { regattaParticipantId: person.id, status: value as Row['status'], arrivalOrder: null, passage: { finish: null }, rank: null, points: null };
          commit([...current.current.filter(row => row.regattaParticipantId !== person.id), replacement]);
        }}>
          <SelectTrigger className="h-10 w-28" aria-label={`Statut du dossard ${person.bibNumber}`}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="DNS">DNS</SelectItem><SelectItem value="DNF">DNF</SelectItem><SelectItem value="PEN">Pénalité</SelectItem></SelectContent>
        </Select>
      </li>)}</ul>}
      <Button size="lg" disabled={locked || validating} onClick={async () => { setValidating(true); try { await onValidate(current.current); setReview(false); } catch { setError('Le classement n’a pas pu être validé. Réessayez.'); setReview(false); } finally { setValidating(false); } }}>{validating ? 'Validation…' : <><Check />Valider et voir le classement</>}</Button>
    </DialogContent></Dialog>
  </section>;
}
