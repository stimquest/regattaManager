"use client";

import * as React from "react";
import { ArrivalEntry } from "./arrival-entry";
import { doc, writeBatch } from "firebase/firestore";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Flag,
  Trophy,
  Users,
  FileDown,
  UserPlus,
  Search,
  Pencil,
  Trash2,
  GripVertical,
  SlidersHorizontal,
  ChevronRight,
  Play,
  PenLine,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { participantDisplayName, participantSearchText, type Heat, type Participant, type RegattaParticipant, type Score, type CompetitorRaceResult } from "@/lib/types";
import { useFirestore } from "@/firebase";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Page, DetailHeader, SectionHeader, EmptyState, HeroStat, LiveDot, Bib, RankBadge } from "@/components/layout/page";


export enum View { HeatsList, HeatDetail, HeatResults, OverallResults, ScoringSettings }
export type OverallResult = { participantId: string; totalPoints: number; scores: Score[]; entryName: string; crewNames: string[]; }

const statusLabel: Record<CompetitorRaceResult['status'], string> = {
  Finished: 'Arrivé',
  DNS: 'DNS',
  DNF: 'DNF',
  PEN: 'Pénalité',
};

function HeatStatusBadge({ status }: { status: Heat['status'] }) {
  if (status === 'In Progress') return <Badge variant="signal"><LiveDot className="h-2 w-2 [&>span]:h-2 [&>span]:w-2" />En cours</Badge>;
  if (status === 'Finished') return <Badge variant="success">Validée</Badge>;
  return <Badge variant="secondary">En attente</Badge>;
}

export function ScoringSettingsView({ regatta, updateScoringRules, setCurrentView }: any) {
  const [rules, setRules] = React.useState(regatta.scoringRules ?? {
    pen: { mode: 'fleetPlus', offset: 1 },
    dns: { mode: 'fleetPlus', offset: 1 },
    dnf: { mode: 'fleetPlus', offset: 1 },
    discards: 0,
  });
  const rows = [
    ['pen', 'PEN', 'Pénalité'],
    ['dns', 'DNS', 'N’a pas pris le départ'],
    ['dnf', 'DNF', 'N’a pas terminé'],
  ] as const;

  return <Page width="narrow">
    <DetailHeader onBack={() => setCurrentView(View.HeatsList)} backLabel="Retour à la régate" eyebrow="Règles de score" title={regatta.name} />
    <section className="space-y-3">
      <SectionHeader title="Points de pénalité" description="Par défaut : nombre d’inscrits + 1 point, comme au club." />
      <div className="divide-y overflow-hidden rounded-3xl border bg-card shadow-soft">
        {rows.map(([key, code, title]) => {
          const rule = rules[key];
          return <div key={key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="flex flex-1 items-center gap-3">
              <span className="flex h-10 w-12 items-center justify-center rounded-xl bg-destructive/10 font-display text-sm font-extrabold text-destructive">{code}</span>
              <span className="font-semibold">{title}</span>
            </div>
            <div className="flex gap-2">
              <Select value={rule.mode} onValueChange={(mode: 'fleetPlus' | 'fixed') => setRules({ ...rules, [key]: mode === 'fixed' ? { mode, points: 1 } : { mode, offset: 1 } })}>
                <SelectTrigger className="flex-1 sm:w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fleetPlus">Inscrits +</SelectItem><SelectItem value="fixed">Valeur fixe</SelectItem></SelectContent>
              </Select>
              <Input aria-label={`Points ${code}`} className="w-20 text-center font-semibold tabular-nums" inputMode="numeric" type="number" min="0" step="1" value={rule.mode === 'fixed' ? rule.points : rule.offset}
                onChange={e => setRules({ ...rules, [key]: rule.mode === 'fixed' ? { ...rule, points: Math.max(0, Number(e.target.value)) } : { ...rule, offset: Math.max(0, Number(e.target.value)) } })} />
            </div>
          </div>;
        })}
      </div>
      <p className="px-1 text-sm text-muted-foreground">Exemple : avec 12 inscrits, « Inscrits + 1 » donne 13 points. Une valeur fixe ne dépend pas du nombre d’inscrits.</p>
    </section>
    <section className="space-y-3">
      <SectionHeader title="Retraits" />
      <div className="flex items-center justify-between gap-4 rounded-3xl border bg-card p-4 shadow-soft sm:p-5">
        <div><p className="font-semibold">Manches retirées</p><p className="text-sm text-muted-foreground">Les moins bonnes de chaque coureur au général.</p></div>
        <NumberStepper id="settings-discards" value={rules.discards} onChange={value => setRules({ ...rules, discards: value })} min={0} />
      </div>
    </section>
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button size="lg" variant="outline" onClick={() => setCurrentView(View.HeatsList)}>Annuler</Button>
      <Button size="lg" onClick={() => { updateScoringRules(rules); setCurrentView(View.HeatsList); }}>Enregistrer les règles</Button>
    </div>
  </Page>;
}


export function SortableParticipantItem({ rp, getParticipantName, openEditDialog, handleDeregister }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({id: rp.id});

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const crew = (rp.crewIds ?? []).map(getParticipantName).filter((name: string) => name !== 'N/A' && name !== rp.entryName);

  return (
    <li ref={setNodeRef} style={style} className={cn("flex items-center gap-2 bg-card py-2 pl-1 pr-2", isDragging && "relative z-10 rounded-2xl shadow-lift")}>
      <button type="button" className="flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground/60 active:cursor-grabbing" aria-label={`Réordonner ${rp.entryName}`} {...attributes} {...listeners}>
        <GripVertical className="h-5 w-5" />
      </button>
      <Bib>{rp.bibNumber}</Bib>
      <div className="min-w-0 flex-1 pl-1">
        <p className="truncate font-semibold">{rp.entryName}</p>
        {crew.length > 0 && <p className="truncate text-[13px] text-muted-foreground">{crew.join(', ')}</p>}
      </div>
      <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground" onClick={() => openEditDialog(rp)} aria-label={`Modifier ${rp.entryName}`}>
        <Pencil />
      </Button>
      <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeregister(rp.id)} aria-label={`Désinscrire ${rp.entryName}`}>
        <Trash2 />
      </Button>
    </li>
  );
}


export const HeatsAndParticipantsView = ({ regatta, sortedRegattaParticipants, allParticipants, availableParticipantsForRegistration, getParticipantName, handleDeregister, handleQuickRegister, openEditDialog, setIsRegisterDialogOpen, startRegistration, handleAddHeat, handleSelectHeat, setCurrentView }: any) => {
  const isTeamMode = regatta.type === 'team' || regatta.type === 'mixed';
  const firestore = useFirestore();
  const [participantSearch, setParticipantSearch] = React.useState('');
  const [tab, setTab] = React.useState(sortedRegattaParticipants.length ? 'heats' : 'participants');
  const matchingAvailableParticipants = React.useMemo(() => availableParticipantsForRegistration.filter((participant: Participant) => `${participantSearchText(participant)} ${participant.club} ${participant.sailType}`.toLocaleLowerCase('fr-FR').includes(participantSearch.trim().toLocaleLowerCase('fr-FR'))), [availableParticipantsForRegistration, participantSearch]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event;

    if (active.id !== over?.id && over) {
      const oldIndex = sortedRegattaParticipants.findIndex((p: RegattaParticipant) => p.id === active.id);
      const newIndex = sortedRegattaParticipants.findIndex((p: RegattaParticipant) => p.id === over.id);

      const newOrder = arrayMove(sortedRegattaParticipants, oldIndex, newIndex);

      const batch = writeBatch(firestore);
      newOrder.forEach((p: any, index) => {
        const docRef = doc(firestore, 'regattas', regatta.id, 'participants', p.id);
        const newBibNumber = sortedRegattaParticipants[index].bibNumber;
        batch.update(docRef, { bibNumber: newBibNumber });
      });

      try {
        await batch.commit();
      } catch (err) {
        console.error("Error reordering participants", err);
      }
    }
  }

  const heats: Heat[] = regatta?.heats ?? [];
  const finishedCount = heats.filter(h => h.status === 'Finished').length;
  const liveHeat = heats.find(h => h.status === 'In Progress');
  const nextHeat = heats.find(h => h.status === 'Not Started');
  const arrivedCount = (heat: Heat) => heat.results.filter(r => r.status === 'Finished' && (r.arrivalOrder != null || r.passage.finish || r.rank != null)).length;

  return (
    <Page>
      <DetailHeader
        backHref="/regattas"
        backLabel="Retour aux régates"
        eyebrow="Gestion de régate"
        title={regatta?.name}
        meta={regatta?.date ? <span className="first-letter:uppercase">{new Date(`${regatta.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span> : null}
        actions={<Button variant="outline" size="icon" className="rounded-full" onClick={() => setCurrentView(View.ScoringSettings)} aria-label="Règles de score"><SlidersHorizontal /></Button>}
      />

      <section className="surface-ink rounded-[28px] p-5 shadow-lift sm:p-6">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <HeroStat value={sortedRegattaParticipants.length} label="Inscrits" />
          <HeroStat value={heats.length} label="Manches" />
          <HeroStat value={finishedCount} label="Validées" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {liveHeat ? (
            <Button variant="signal" size="xl" className="col-span-2 sm:col-span-1" onClick={() => handleSelectHeat(liveHeat)}><LiveDot className="[&>span]:bg-white" />Continuer · {liveHeat.name}</Button>
          ) : nextHeat ? (
            <Button variant="signal" size="xl" className="col-span-2 sm:col-span-1" onClick={() => handleSelectHeat(nextHeat)}><PenLine className="!size-5" />Saisir · {nextHeat.name}</Button>
          ) : (
            <Button variant="signal" size="xl" className="col-span-2 sm:col-span-1" onClick={() => { handleAddHeat(); setTab('heats'); }}><Plus className="!size-5" />Nouvelle manche</Button>
          )}
          <Button size="xl" className="col-span-2 border border-white/15 bg-white/10 text-white shadow-none hover:bg-white/15 sm:col-span-1" onClick={() => setCurrentView(View.OverallResults)} disabled={finishedCount === 0}>
            <Trophy className="!size-5" />Classement général
          </Button>
        </div>
      </section>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="heats"><Flag />Manches <span className="tabular-nums text-muted-foreground">{heats.length}</span></TabsTrigger>
          <TabsTrigger value="participants"><Users />Inscrits <span className="tabular-nums text-muted-foreground">{sortedRegattaParticipants.length}</span></TabsTrigger>
        </TabsList>

        <TabsContent value="heats" className="space-y-3">
          {heats.length === 0 ? (
            <EmptyState icon={Flag} title="Aucune manche" action={<Button size="lg" onClick={handleAddHeat}><Plus />Créer la première manche</Button>}>
              {sortedRegattaParticipants.length ? 'Créez une manche, puis reportez la feuille d’arrivée ou suivez-la en direct.' : 'Inscrivez d’abord les participants, puis créez une manche.'}
            </EmptyState>
          ) : (
            <>
              <ul className="rise-stagger grid grid-cols-1 gap-3 md:grid-cols-2">
                {heats.map((heat, index) => {
                  const arrived = arrivedCount(heat);
                  const total = heat.results.length || sortedRegattaParticipants.length;
                  return (
                    <li key={heat.id}>
                      <button type="button" onClick={() => handleSelectHeat(heat)} className={cn("pressable flex w-full items-center gap-4 rounded-3xl border bg-card p-4 text-left shadow-soft hover:border-foreground/15 hover:shadow-lift", heat.status === 'In Progress' && "border-signal/40 ring-1 ring-signal/30")}>
                        <span className={cn("flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl font-display leading-none", heat.status === 'Finished' ? "bg-success/12 text-success" : heat.status === 'In Progress' ? "bg-signal/12 text-signal" : "bg-muted text-foreground")}>
                          <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">M</span>
                          <span className="text-2xl font-extrabold tabular-nums">{index + 1}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2"><span className="truncate font-display text-lg font-bold">{heat.name}</span></span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1"><HeatStatusBadge status={heat.status} /><span className="whitespace-nowrap text-[13px] tabular-nums text-muted-foreground">{arrived}/{total} arrivés</span></span>
                          <span className="mt-2.5 block h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                            <span className={cn("block h-full rounded-full", heat.status === 'Finished' ? "bg-success" : "bg-signal")} style={{ width: `${total ? Math.round((arrived / total) * 100) : 0}%` }} />
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
                          <span className="hidden sm:inline">{heat.status === 'Not Started' ? 'Saisir' : heat.status === 'In Progress' ? 'Continuer' : 'Résultats'}</span>
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Button variant="outline" size="lg" className="w-full border-dashed" onClick={handleAddHeat}><Plus />Ajouter une manche</Button>
            </>
          )}
        </TabsContent>

        <TabsContent value="participants" className="space-y-8">
          <section className="space-y-3">
            <SectionHeader
              title="Inscrits"
              description={sortedRegattaParticipants.length ? 'Glissez la poignée pour réattribuer les dossards.' : undefined}
              action={<Button onClick={() => startRegistration()}><UserPlus />{isTeamMode ? 'Équipe' : 'Inscrire'}</Button>}
            />
            {sortedRegattaParticipants.length === 0 ? (
              <EmptyState icon={Users} title="Personne d’inscrit" action={<Button size="lg" onClick={() => startRegistration()}><UserPlus />{isTeamMode ? 'Inscrire une équipe' : 'Inscrire un coureur'}</Button>}>
                Saisissez le dossard remis, puis retrouvez le coureur ou créez sa fiche.
              </EmptyState>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sortedRegattaParticipants.map((p: RegattaParticipant) => p.id)} strategy={verticalListSortingStrategy}>
                  <ul className="divide-y rounded-3xl border bg-card shadow-soft [&>li:first-child]:rounded-t-3xl [&>li:last-child]:rounded-b-3xl">
                    {sortedRegattaParticipants.map((rp: RegattaParticipant) => (
                      <SortableParticipantItem
                        key={rp.id}
                        rp={rp}
                        getParticipantName={getParticipantName}
                        openEditDialog={openEditDialog}
                        handleDeregister={handleDeregister}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </section>

          <section className="space-y-3">
            <SectionHeader title="Coureurs de l’annuaire" description={`${availableParticipantsForRegistration?.length ?? 0} pas encore inscrits`} />
            <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input type="search" enterKeyHint="search" className="rounded-2xl pl-11 shadow-soft" placeholder="Rechercher un coureur ou un club" value={participantSearch} onChange={event => setParticipantSearch(event.target.value)} /></div>
            {matchingAvailableParticipants.length === 0 ? (
              <p className="rounded-3xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                {availableParticipantsForRegistration.length === 0 ? 'Tous les coureurs de l’annuaire sont inscrits.' : 'Aucun coureur ne correspond à la recherche.'}
              </p>
            ) : (
              <ul className="divide-y overflow-hidden rounded-3xl border bg-card shadow-soft">
                {matchingAvailableParticipants.slice(0, 40).map((p: Participant) => (
                  <li key={p.id} className="flex min-h-[64px] items-center gap-3 px-4 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{participantDisplayName(p)}</p>
                      <p className="truncate text-[13px] text-muted-foreground">{p.club} · {p.sailType === 'Dinghy' ? 'Dériveur' : p.sailType}</p>
                    </div>
                    {!isTeamMode && (
                      <Button size="sm" variant="secondary" className="h-10 rounded-full px-4" onClick={() => handleQuickRegister(p)}>
                        <Plus />Inscrire
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {matchingAvailableParticipants.length > 40 && <p className="text-center text-xs text-muted-foreground">Affinez la recherche pour voir les {matchingAvailableParticipants.length - 40} autres.</p>}
          </section>
        </TabsContent>
      </Tabs>
    </Page>
  );
}

type HeatDetailProps = {
  activeHeat?: Heat;
  regattaParticipants: RegattaParticipant[];
  isTimerActive: boolean;
  timeLeft: number;
  selectedDuration: string;
  setSelectedDuration: (value: string) => void;
  handleStartSequence: () => void;
  handleResetTimer: () => void;
  validateArrivalRows: (rows: CompetitorRaceResult[]) => Promise<void>;
  persistArrivalRows: (rows: CompetitorRaceResult[]) => Promise<void>;
  entryMode: 'paper' | 'live';
  setEntryMode: (mode: 'paper' | 'live') => void;
  setCurrentView: (view: View) => void;
  formatTime: (seconds: number) => string;
};

/** Panneau de départ : compte à rebours lisible de loin, lancement au pouce. */
function StartPanel({ activeHeat, isTimerActive, timeLeft, selectedDuration, setSelectedDuration, handleStartSequence, handleResetTimer, formatTime }: Pick<HeatDetailProps, 'isTimerActive' | 'timeLeft' | 'selectedDuration' | 'setSelectedDuration' | 'handleStartSequence' | 'handleResetTimer' | 'formatTime'> & { activeHeat: Heat }) {
  const started = activeHeat.status === 'In Progress';
  const elapsed = useElapsed(started ? activeHeat.startTime : null);
  return (
    <div className="surface-ink flex items-center gap-3 rounded-2xl px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">
          {started ? <><LiveDot />Départ donné</> : isTimerActive ? 'Séquence de départ' : 'Avant le départ'}
        </p>
        <p className={cn("font-display text-4xl font-extrabold leading-none tabular-nums", isTimerActive && timeLeft <= 10 && "text-signal")}>
          {started ? elapsed : formatTime(timeLeft)}
        </p>
      </div>
      {activeHeat.status === 'Not Started' && <>
        <Select onValueChange={setSelectedDuration} value={selectedDuration} disabled={isTimerActive}>
          <SelectTrigger className="h-12 w-[5.5rem] border-white/15 bg-white/10 text-white focus:ring-white/20" aria-label="Durée de la séquence"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="0">Immédiat</SelectItem><SelectItem value="30">30 s</SelectItem><SelectItem value="60">1 min</SelectItem><SelectItem value="180">3 min</SelectItem><SelectItem value="300">5 min</SelectItem></SelectContent>
        </Select>
        <Button size="lg" variant={isTimerActive ? 'outline' : 'signal'} className={cn("h-12", isTimerActive && "border-white/20 bg-transparent text-white hover:bg-white/10")} onClick={isTimerActive ? handleResetTimer : handleStartSequence}>
          {isTimerActive ? 'Annuler' : <><Play className="fill-current" />Départ</>}
        </Button>
      </>}
    </div>
  );
}

function useElapsed(start: number | null) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!start) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [start]);
  if (!start) return '00:00';
  const seconds = Math.max(0, Math.floor((now - start) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const HeatDetailView = ({ activeHeat, regattaParticipants, isTimerActive, timeLeft, selectedDuration, setSelectedDuration, handleStartSequence, handleResetTimer, validateArrivalRows, persistArrivalRows, entryMode, setEntryMode, setCurrentView, formatTime }: HeatDetailProps) => activeHeat ? (
  <ArrivalEntry key={activeHeat.id} heat={activeHeat} participants={regattaParticipants} mode={entryMode} onMode={setEntryMode}
    onSave={persistArrivalRows} onBack={() => setCurrentView(View.HeatsList)} onResults={() => setCurrentView(View.HeatResults)} onValidate={validateArrivalRows}
    timer={<StartPanel activeHeat={activeHeat} isTimerActive={isTimerActive} timeLeft={timeLeft} selectedDuration={selectedDuration} setSelectedDuration={setSelectedDuration} handleStartSequence={handleStartSequence} handleResetTimer={handleResetTimer} formatTime={formatTime} />}
  />
) : null;

/** Podium : 2 · 1 · 3, la marche du vainqueur au centre. */
function Podium({ entries }: { entries: { key: string; name: string; bib?: string; value: React.ReactNode; rank: number }[] }) {
  if (entries.length === 0) return null;
  const order = [entries[1], entries[0], entries[2]].filter(Boolean);
  const height: Record<number, string> = { 1: 'h-24', 2: 'h-16', 3: 'h-12' };
  return (
    <section className="surface-ink rounded-[28px] px-4 pb-0 pt-6 shadow-lift sm:px-8">
      <div className="mx-auto grid max-w-lg grid-cols-3 items-end gap-2 sm:gap-4">
        {order.map(entry => (
          <div key={entry.key} className={cn("flex min-w-0 flex-col items-center text-center", entry.rank === 1 ? "order-2" : entry.rank === 2 ? "order-1" : "order-3")}>
            <RankBadge rank={entry.rank} className={entry.rank === 1 ? "h-12 w-12 text-lg" : ""} />
            <p className="mt-2 w-full truncate text-sm font-bold">{entry.name}</p>
            {entry.bib && <p className="text-xs text-white/60">Dossard {entry.bib}</p>}
            <p className="mb-2 mt-1 font-display text-lg font-extrabold tabular-nums text-signal">{entry.value}</p>
            <div className={cn("w-full rounded-t-2xl bg-white/[0.08] ring-1 ring-inset ring-white/10", height[entry.rank])} />
          </div>
        ))}
      </div>
    </section>
  );
}

export const HeatResultsView = ({ activeHeat, regattaParticipants, setCurrentView, getParticipantName }: any) => {
  const sortedResults = React.useMemo(() => {
    if (!activeHeat?.results) return [];
    return [...activeHeat.results].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  }, [activeHeat]);
  const find = (id: string) => regattaParticipants?.find((p: RegattaParticipant) => p.id === id);
  const podium = sortedResults.filter((r: CompetitorRaceResult) => r.rank != null && r.rank <= 3).map((r: CompetitorRaceResult) => {
    const rp = find(r.regattaParticipantId);
    return { key: r.regattaParticipantId, name: rp?.entryName ?? '?', bib: rp?.bibNumber, value: `${r.points} pt${(r.points ?? 0) > 1 ? 's' : ''}`, rank: r.rank as number };
  });

  return (
    <Page width="narrow">
      <DetailHeader
        onBack={() => setCurrentView(View.HeatsList)}
        backLabel="Retour aux manches"
        eyebrow="Résultats de manche"
        title={activeHeat?.name}
        actions={activeHeat?.status === 'Finished' && <Button variant="outline" onClick={() => setCurrentView(View.HeatDetail)}><Pencil />Corriger</Button>}
      />
      <Podium entries={podium} />
      <ol className="divide-y overflow-hidden rounded-3xl border bg-card shadow-soft">
        {sortedResults.map((result: CompetitorRaceResult) => {
          const rp = find(result.regattaParticipantId);
          if (!rp) return null;
          const crew = (rp.crewIds ?? []).map(getParticipantName).filter((name: string) => name !== 'N/A' && name !== rp.entryName);
          return <li key={result.regattaParticipantId} className="flex min-h-[68px] items-center gap-3 px-4 py-2">
            <RankBadge rank={result.rank} />
            <Bib className="h-9 min-w-10 text-base">{rp.bibNumber}</Bib>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{rp.entryName}</p>
              <p className="truncate text-[13px] text-muted-foreground">
                {result.status !== 'Finished' ? <span className="font-semibold text-destructive">{statusLabel[result.status as CompetitorRaceResult['status']]}</span> : result.passage?.finish ? <span className="tabular-nums">{result.passage.finish}</span> : 'Arrivé'}
                {crew.length > 0 && ` · ${crew.join(', ')}`}
              </p>
            </div>
            <div className="text-right"><p className="font-display text-xl font-extrabold tabular-nums">{result.points}</p><p className="text-[11px] text-muted-foreground">pts</p></div>
          </li>;
        })}
      </ol>
    </Page>
  );
}

export const OverallResultsView = ({ regatta, finishedHeats, selectedSailType, setSelectedSailType, selectedCategory, setSelectedCategory, numDiscards, setNumDiscards, discards, setDiscards, calculateOverallResults, handleExportCSV, setCurrentView }: any) => {
  const overallResults: OverallResult[] = calculateOverallResults(selectedSailType, selectedCategory);
  const categories = ['Général', 'Jeune', 'Confirmé', 'Vétéran', 'Catamaran', 'Dériveur'];
  const podium = overallResults.slice(0, 3).map((result, index) => ({ key: result.participantId, name: result.entryName, value: `${result.totalPoints} pt${result.totalPoints > 1 ? "s" : ""}`, rank: index + 1 }));
  const crewOf = (result: OverallResult) => result.crewNames.filter(name => name !== result.entryName);

  return (
    <Page>
      <DetailHeader
        onBack={() => setCurrentView(View.HeatsList)}
        backLabel="Retour à la régate"
        eyebrow="Classement général"
        title={regatta?.name}
        meta={<span>{finishedHeats.length} manche{finishedHeats.length > 1 ? 's' : ''} validée{finishedHeats.length > 1 ? 's' : ''}{discards > 0 ? ` · ${discards} retrait${discards > 1 ? 's' : ''}` : ''}</span>}
        actions={<Button variant="outline" onClick={handleExportCSV} disabled={overallResults.length === 0}><FileDown /><span className="hidden sm:inline">Exporter</span> CSV</Button>}
      />

      <section className="space-y-3">
        <Tabs value={selectedSailType} onValueChange={(value) => setSelectedSailType(value as any)}>
          <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="Général">Tous</TabsTrigger><TabsTrigger value="Windsurf">Windsurf</TabsTrigger><TabsTrigger value="Wingfoil">Wingfoil</TabsTrigger></TabsList>
        </Tabs>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="radiogroup" aria-label="Catégorie">
          {categories.map(category => {
            const active = selectedCategory === category;
            return <button key={category} type="button" role="radio" aria-checked={active} onClick={() => setSelectedCategory(category as any)} className={cn("press-feedback h-10 shrink-0 rounded-full border px-4 text-sm font-semibold", active ? "border-ink bg-ink text-ink-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
              {category === 'Général' ? 'Toutes catégories' : category}
            </button>;
          })}
        </div>
        <div className="flex items-center justify-between gap-3 rounded-3xl border bg-card p-3 pl-4 shadow-soft">
          <Label htmlFor="discards-input" className="text-sm">Manches retirées</Label>
          <div className="flex items-center gap-2">
            <NumberStepper id="discards-input" value={numDiscards} onChange={setNumDiscards} min={0} max={finishedHeats.length > 0 ? finishedHeats.length - 1 : 0} />
            <Button onClick={() => setDiscards(numDiscards)} disabled={numDiscards === discards}>Appliquer</Button>
          </div>
        </div>
      </section>

      {overallResults.length === 0 ? (
        <EmptyState icon={Trophy} title="Aucun résultat">Personne dans cette sélection pour le moment.</EmptyState>
      ) : (
        <>
          <Podium entries={podium} />

          <ol className="divide-y overflow-hidden rounded-3xl border bg-card shadow-soft md:hidden">
            {overallResults.map((result, index) => <li key={result.participantId} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <RankBadge rank={index + 1} />
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{result.entryName}</p>{crewOf(result).length > 0 && <p className="truncate text-[13px] text-muted-foreground">{crewOf(result).join(', ')}</p>}</div>
                <div className="text-right"><p className="font-display text-xl font-extrabold tabular-nums">{result.totalPoints}</p><p className="text-[11px] text-muted-foreground">pts</p></div>
              </div>
              <div className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto pl-[52px]">
                {result.scores.map((score, scoreIndex) => <span key={score.heatId} className={cn('shrink-0 rounded-lg bg-muted px-2 py-1 text-xs font-medium tabular-nums', score.isDiscarded && 'text-muted-foreground line-through opacity-60')}>
                  <span className="text-muted-foreground">M{scoreIndex + 1}</span> {score.rank}
                </span>)}
              </div>
            </li>)}
          </ol>

          <div className="hidden overflow-hidden rounded-3xl border bg-card shadow-soft md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16 pl-5">Rang</TableHead>
                  <TableHead>Nom</TableHead>
                  {finishedHeats.map((h: Heat, i: number) => (
                    <TableHead key={h.id} className="text-center" title={h.name}>M{i + 1}</TableHead>
                  ))}
                  <TableHead className="pr-5 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overallResults.map((result, index) => (
                  <TableRow key={result.participantId}>
                    <TableCell className="pl-5"><RankBadge rank={index + 1} className="h-9 w-9 text-sm" /></TableCell>
                    <TableCell>
                      <p className="font-semibold">{result.entryName}</p>
                      {crewOf(result).length > 0 && <p className="text-xs text-muted-foreground">{crewOf(result).join(', ')}</p>}
                    </TableCell>
                    {result.scores.map((score, i) => (
                      <TableCell key={i} className={cn("text-center tabular-nums", score.isDiscarded && "text-muted-foreground line-through")}>{score.rank}</TableCell>
                    ))}
                    <TableCell className="pr-5 text-right font-display text-lg font-extrabold tabular-nums">{result.totalPoints}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </Page>
  );
}
