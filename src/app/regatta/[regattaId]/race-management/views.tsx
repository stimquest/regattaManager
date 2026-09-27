
"use client";

import * as React from "react";
import { ArrivalEntry } from "./arrival-entry";
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { doc, collection, updateDoc, CollectionReference, addDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  Play,
  Plus,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Flag,
  ListOrdered,
  Trophy,
  RefreshCw,
  Clock,
  Loader2,
  Users,
  ShieldAlert,
  Calculator,
  FileDown,
  CheckCircle,
  UserPlus,
  Search,
  FileEdit,
  Trash2,
  GripVertical
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { participantDisplayName, participantSearchText, type Heat, type Regatta, type Participant, type RegattaParticipant, type Score, type CompetitorRaceResult } from "@/lib/types";
import { useFirestore, useDoc, useCollection } from "@/firebase";
import { emitFirestoreError } from "@/firebase/errors";
import { NumberStepper } from "@/components/ui/number-stepper";
import { ScrollArea } from "@/components/ui/scroll-area";


export enum View { HeatsList, HeatDetail, HeatResults, OverallResults, ScoringSettings }
export type OverallResult = { participantId: string; totalPoints: number; scores: Score[]; entryName: string; crewNames: string[]; }

export function ScoringSettingsView({ regatta, updateScoringRules, setCurrentView }: any) {
  const [rules, setRules] = React.useState(regatta.scoringRules ?? {
    pen: { mode: 'fleetPlus', offset: 1 },
    dns: { mode: 'fleetPlus', offset: 1 },
    dnf: { mode: 'fleetPlus', offset: 1 },
    discards: 0,
  });
  const rows = [
    ['pen', 'PEN · Pénalité'],
    ['dns', 'DNS · N’a pas pris le départ'],
    ['dnf', 'DNF · N’a pas terminé'],
  ] as const;

  return <main className="flex flex-1 flex-col p-4 md:p-6">
    <div className="flex items-center gap-3 mb-6">
      <Button variant="ghost" size="icon" onClick={() => setCurrentView(View.HeatsList)}><ArrowLeft className="h-5 w-5" /></Button>
      <div><h1 className="text-2xl font-bold">Règles de score</h1><p className="text-sm text-muted-foreground">{regatta.name}</p></div>
    </div>
    <Card className="max-w-2xl">
      <CardHeader><CardTitle>Points de pénalité</CardTitle><CardDescription>Réglez séparément chaque statut. Le réglage actuel du club est conservé par défaut : nombre d’inscrits + 1 point.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        {rows.map(([key, title]) => {
          const rule = rules[key];
          return <div key={key} className="grid grid-cols-1 sm:grid-cols-[1fr_180px_110px] gap-3 items-center">
            <Label>{title}</Label>
            <Select value={rule.mode} onValueChange={(mode: 'fleetPlus' | 'fixed') => setRules({ ...rules, [key]: mode === 'fixed' ? { mode, points: 1 } : { mode, offset: 1 } })}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fleetPlus">Inscrits +</SelectItem><SelectItem value="fixed">Valeur fixe</SelectItem></SelectContent>
            </Select>
            <Input aria-label={`Points ${key}`} type="number" min="0" step="1" value={rule.mode === 'fixed' ? rule.points : rule.offset}
              onChange={e => setRules({ ...rules, [key]: rule.mode === 'fixed' ? { ...rule, points: Math.max(0, Number(e.target.value)) } : { ...rule, offset: Math.max(0, Number(e.target.value)) } })} />
          </div>;
        })}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px] gap-3 items-center border-t pt-4">
          <Label htmlFor="settings-discards">Manches à retirer du classement général</Label>
          <Input id="settings-discards" type="number" min="0" step="1" value={rules.discards} onChange={e => setRules({ ...rules, discards: Math.max(0, Number(e.target.value)) })} />
        </div>
        <p className="text-sm text-muted-foreground">Exemple : avec 12 inscrits, « Inscrits + 1 » attribue 13 points. Une valeur fixe reste identique quel que soit le nombre de participants.</p>
      </CardContent>
    </Card>
    <div className="flex gap-3 mt-4">
      <Button onClick={() => { updateScoringRules(rules); setCurrentView(View.HeatsList); }}>Enregistrer les règles</Button>
      <Button variant="outline" onClick={() => setCurrentView(View.HeatsList)}>Annuler</Button>
    </div>
  </main>;
}


export function SortableParticipantItem({ rp, getParticipantName, openEditDialog, handleDeregister }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({id: rp.id});
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card ref={setNodeRef} style={style} className="rounded-xl p-3">
      <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 flex-1 min-w-0">
              <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 cursor-grab touch-none" aria-label={`Réordonner ${rp.entryName}`} {...attributes} {...listeners}>
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </Button>
              <Badge variant="secondary" className="text-base font-bold h-8 w-12 flex-shrink-0 flex items-center justify-center">{rp.bibNumber}</Badge>
              <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{rp.entryName}</p>
                  {rp.crewIds && rp.crewIds.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                          {rp.crewIds.map(getParticipantName).join(', ')}
                      </p>
                  )}
              </div>
          </div>
          <div className="flex-shrink-0">
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={() => openEditDialog(rp)} aria-label={`Modifier ${rp.entryName}`}>
                <FileEdit className="h-4 w-4"/>
            </Button>
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl" onClick={() => handleDeregister(rp.id)} aria-label={`Désinscrire ${rp.entryName}`}>
                <Trash2 className="h-4 w-4 text-destructive"/>
            </Button>
          </div>
      </div>
    </Card>
  );
}


export const HeatsAndParticipantsView = ({ regatta, sortedRegattaParticipants, allParticipants, availableParticipantsForRegistration, getParticipantName, handleDeregister, handleQuickRegister, openEditDialog, setIsRegisterDialogOpen, startRegistration, handleAddHeat, handleSelectHeat, setCurrentView }: any) => {
  const isTeamMode = regatta.type === 'team' || regatta.type === 'mixed';
  const firestore = useFirestore();
  const [participantSearch, setParticipantSearch] = React.useState('');
  const matchingAvailableParticipants = React.useMemo(() => availableParticipantsForRegistration.filter((participant: Participant) => `${participantSearchText(participant)} ${participant.club} ${participant.sailType}`.toLocaleLowerCase('fr-FR').includes(participantSearch.trim().toLocaleLowerCase('fr-FR'))), [availableParticipantsForRegistration, participantSearch]);

  const sensors = useSensors(
    useSensor(PointerSensor),
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
        // Potentially show a toast to the user
      }
    }
  }


  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 pb-28 md:p-8">
      <section className="flex items-center gap-3 rounded-2xl border bg-card p-3 sm:p-4">
         <Button asChild variant="outline" size="icon" className="h-12 w-12 shrink-0 rounded-xl"><Link href="/" aria-label="Retour aux régates"><ArrowLeft className="h-5 w-5"/></Link></Button>
         <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Gestion de régate</p><h1 className="truncate text-xl font-bold sm:text-2xl">{regatta?.name}</h1><p className="text-sm text-muted-foreground">{sortedRegattaParticipants.length} inscrit{sortedRegattaParticipants.length === 1 ? '' : 's'} · {regatta.heats.length} manche{regatta.heats.length === 1 ? '' : 's'}</p></div>
         <Button variant="outline" className="hidden h-11 shrink-0 sm:inline-flex" onClick={() => setCurrentView(View.ScoringSettings)}>Règles de score</Button>
      </section>
       <Tabs defaultValue="participants" className="w-full">
        <TabsList className="grid h-14 w-full grid-cols-2 rounded-xl p-1">
          <TabsTrigger value="heats">Manches</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
        </TabsList>
        <TabsContent value="heats">
           <div className="my-4 grid grid-cols-2 gap-3 md:grid-cols-3">
             <Button className="h-12 rounded-xl" onClick={handleAddHeat}>
              <Plus className="mr-2 h-4 w-4"/>Ajouter une manche
            </Button>
            <Button className="h-12 rounded-xl" variant="secondary" onClick={() => setCurrentView(View.OverallResults)} disabled={(regatta?.heats.filter((h: Heat) => h.status === 'Finished').length ?? 0) === 0}>
              <Trophy className="h-4 w-4 mr-2"/>
              Classement général
            </Button>
            <Button className="col-span-2 h-12 rounded-xl sm:col-span-1 md:hidden" variant="outline" onClick={() => setCurrentView(View.ScoringSettings)}>Règles de score</Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {regatta?.heats.map((heat: Heat) => (
              <Card 
                key={heat.id} 
                className="rounded-2xl p-4"
              >
                 <CardHeader className="mb-2 p-0">
                  <div className="flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <Flag className="h-5 w-5 text-muted-foreground"/>
                      <CardTitle className="truncate text-lg">{heat.name}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3 p-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", heat.status === "In Progress" ? "bg-emerald-500" : heat.status === "Finished" ? "bg-blue-500" : "bg-muted-foreground/50")} />
                    <p className="truncate text-sm text-muted-foreground">
                      {heat.status === 'Not Started' ? 'En attente' : heat.status === 'In Progress' ? 'En cours' : 'Terminée'}
                    </p>
                  </div>
                  <Button className="h-11 shrink-0 rounded-xl" variant={heat.status === 'In Progress' ? 'default' : 'outline'} onClick={() => handleSelectHeat(heat)}>{heat.status === 'Not Started' ? 'Saisir' : heat.status === 'In Progress' ? 'Continuer' : 'Résultats'}</Button>
                </CardContent>
              </Card>
            ))}
             {regatta?.heats.length === 0 && (
              <p className="text-muted-foreground col-span-1 md:col-span-2 text-center mt-4">Aucune manche créée pour le moment.</p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="participants">
           <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div>
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5"/>
                      Inscrits · {sortedRegattaParticipants?.length ?? 0}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => startRegistration()} className="mb-4 h-12 w-full rounded-xl">
                        <UserPlus className="mr-2 h-4 w-4"/> {isTeamMode ? 'Inscrire une équipe' : 'Inscrire un coureur'}
                    </Button>
                    <div className="pr-1">
                      <DndContext 
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext 
                          items={sortedRegattaParticipants.map((p:RegattaParticipant) => p.id)}
                          strategy={verticalListSortingStrategy}
                        >
                           <div className="space-y-2">
                            {sortedRegattaParticipants.map((rp: RegattaParticipant) => (
                              <SortableParticipantItem 
                                key={rp.id} 
                                id={rp.id}
                                rp={rp}
                                getParticipantName={getParticipantName}
                                openEditDialog={openEditDialog}
                                handleDeregister={handleDeregister}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                         {sortedRegattaParticipants.length === 0 && (
                            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                              Inscrivez les participants avant d’ajouter une manche.
                            </div>
                         )}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div>
                 <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5"/>
                      Coureurs déjà connus · {availableParticipantsForRegistration?.length ?? 0}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {!isTeamMode && <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                        <p className="text-sm text-muted-foreground">Nouveau nom sur la feuille ? Crée sa fiche et inscris-le ici, sans quitter la régate.</p>
                        <Button className="mt-3 h-12 w-full rounded-xl" onClick={() => startRegistration()}>
                          <UserPlus className="mr-2 h-4 w-4"/> Nouveau concurrent + dossard
                        </Button>
                      </div>}
                      <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input className="h-12 rounded-xl pl-10" placeholder="Rechercher un coureur ou un club" value={participantSearch} onChange={event => setParticipantSearch(event.target.value)} /></div>
                      <div className="space-y-2">
                        {matchingAvailableParticipants.map((p: Participant) => (
                          <Card key={p.id} className="rounded-xl p-3">
                            <div className="flex justify-between items-center">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{participantDisplayName(p)}</p>
                                <p className="text-xs text-muted-foreground truncate">{p.club} - {p.sailType}</p>
                              </div>
                              {!isTeamMode && (
                                <Button size="sm" className="h-11 rounded-xl" variant="outline" onClick={() => handleQuickRegister(p)}>
                                  <Plus className="mr-2 h-4 w-4"/>
                                  Inscrire
                                </Button>
                              )}
                            </div>
                          </Card>
                        ))}
                         {matchingAvailableParticipants.length === 0 && (
                            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                              {availableParticipantsForRegistration.length === 0 ? 'Tous les coureurs sont inscrits.' : 'Aucun coureur ne correspond à la recherche.'}
                            </div>
                         )}
                      </div>
                    </div>
                  </CardContent>
                 </Card>
              </div>
           </div>
        </TabsContent>
      </Tabs>
    </main>
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

export const HeatDetailView = ({ activeHeat, regattaParticipants, isTimerActive, timeLeft, selectedDuration, setSelectedDuration, handleStartSequence, handleResetTimer, validateArrivalRows, persistArrivalRows, entryMode, setEntryMode, setCurrentView, formatTime }: HeatDetailProps) => activeHeat ? (
  <ArrivalEntry key={activeHeat.id} heat={activeHeat} participants={regattaParticipants} mode={entryMode} onMode={setEntryMode}
    onSave={persistArrivalRows} onBack={() => setCurrentView(View.HeatsList)} onResults={() => setCurrentView(View.HeatResults)} onValidate={validateArrivalRows}
    timer={<div className="flex flex-wrap items-center gap-2">
      <span className="mr-auto font-mono text-2xl font-bold tabular-nums">{activeHeat.status === 'In Progress' ? 'Départ donné' : formatTime(timeLeft)}</span>
      {activeHeat.status === 'Not Started' && <><Select onValueChange={setSelectedDuration} value={selectedDuration} disabled={isTimerActive}><SelectTrigger className="h-11 w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Immédiat</SelectItem><SelectItem value="30">30 s</SelectItem><SelectItem value="60">1 min</SelectItem><SelectItem value="180">3 min</SelectItem><SelectItem value="300">5 min</SelectItem></SelectContent></Select><Button className="h-11" onClick={isTimerActive ? handleResetTimer : handleStartSequence}>{isTimerActive ? 'Annuler' : 'Départ'}</Button></>}
    </div>}
  />
) : null;

export const HeatResultsView = ({ activeHeat, regattaParticipants, setCurrentView, getParticipantName }: any) => {
  const sortedResults = React.useMemo(() => {
    if (!activeHeat?.results) return [];
    return [...activeHeat.results].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  }, [activeHeat]);

  return (
    <main className="flex flex-1 flex-col p-4 md:p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setCurrentView(View.HeatDetail)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Résultats - {activeHeat?.name}</h1>
      </div>
      {activeHeat?.status === 'Finished' && <Button className="mb-4 h-12 self-end" variant="outline" onClick={() => setCurrentView(View.HeatDetail)}>Corriger les arrivées</Button>}
      <Card>
        <CardHeader>
          <CardTitle>Classement de la Manche</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-3 sm:p-6">
          <ol className="space-y-2 md:hidden">
            {sortedResults.map((result: CompetitorRaceResult, index: number) => {
              const rp = regattaParticipants?.find((p: RegattaParticipant) => p.id === result.regattaParticipantId);
              if (!rp) return null;
              return <li key={result.regattaParticipantId} className="flex items-center gap-3 rounded-xl border p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{result.rank ?? index + 1}</span>
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{rp.entryName}</p><p className="text-sm text-muted-foreground">Dossard {rp.bibNumber} · {result.status}</p></div>
                <div className="text-right"><p className="text-lg font-bold tabular-nums">{result.points}</p><p className="text-xs text-muted-foreground">points</p></div>
              </li>;
            })}
          </ol>
          <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Rang</TableHead>
                <TableHead>Équipage</TableHead>
                <TableHead>Dossard</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedResults.map((result: CompetitorRaceResult) => {
                const rp = regattaParticipants?.find((p: RegattaParticipant) => p.id === result.regattaParticipantId);
                if (!rp) return null;
                return (
                  <TableRow key={result.regattaParticipantId}>
                    <TableCell className="font-bold">{result.rank || '-'}</TableCell>
                    <TableCell>
                      <p className="font-medium">{rp.entryName}</p>
                      {rp.crewIds && rp.crewIds.length > 0 && (
                        <p className="text-xs text-muted-foreground">{rp.crewIds.map(getParticipantName).join(', ')}</p>
                      )}
                    </TableCell>
                    <TableCell>{rp.bibNumber}</TableCell>
                    <TableCell>
                      <Badge variant={result.status === 'Finished' ? 'default' : 'destructive'} >{result.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{result.points}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export const OverallResultsView = ({ regatta, finishedHeats, selectedSailType, setSelectedSailType, selectedCategory, setSelectedCategory, numDiscards, setNumDiscards, discards, setDiscards, calculateOverallResults, handleExportCSV, setCurrentView }: any) => {
  const overallResults = calculateOverallResults(selectedSailType, selectedCategory);
  
  return (
    <main className="flex flex-1 flex-col p-4 md:p-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setCurrentView(View.HeatsList)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold sm:text-xl">Classement général · {regatta?.name}</h1>
        </div>
         <Button variant="outline" className="h-11 shrink-0" onClick={handleExportCSV} disabled={overallResults.length === 0}>
          <FileDown className="h-4 w-4 mr-2" />
          Exporter en CSV
        </Button>
      </div>
      <Card className="mb-4 rounded-2xl">
        <CardHeader>
            <CardTitle className="text-lg">Manches à retirer</CardTitle>
            <CardDescription>Le nombre de retraits défini dans les règles de score.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
           <Label htmlFor="discards-input" className="whitespace-nowrap text-sm text-muted-foreground">Manches à retirer :</Label>
            <NumberStepper 
              id="discards-input"
              className="gap-2"
              value={numDiscards}
              onChange={setNumDiscards}
              min={0}
              max={finishedHeats.length > 0 ? finishedHeats.length -1 : 0}
            />
            <Button className="h-11" onClick={() => setDiscards(numDiscards)}>
              <Calculator className="h-4 w-4 mr-2" />
              Appliquer
            </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label className="text-sm font-semibold">Support</Label><Tabs value={selectedSailType} onValueChange={(value) => setSelectedSailType(value as any)} className="w-full"><TabsList className="grid h-12 w-full grid-cols-3 rounded-xl"><TabsTrigger value="Général">Tous</TabsTrigger><TabsTrigger value="Windsurf">Windsurf</TabsTrigger><TabsTrigger value="Wingfoil">Wingfoil</TabsTrigger></TabsList></Tabs></div>
          <div className="space-y-2"><Label htmlFor="overall-category" className="text-sm font-semibold">Catégorie</Label><Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as any)}><SelectTrigger id="overall-category" className="h-12 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Général">Toutes les catégories</SelectItem><SelectItem value="Jeune">Jeune</SelectItem><SelectItem value="Confirmé">Confirmé</SelectItem><SelectItem value="Vétéran">Vétéran</SelectItem><SelectItem value="Catamaran">Catamaran</SelectItem><SelectItem value="Dériveur">Dériveur</SelectItem></SelectContent></Select></div>
      </div>
      
         <Card className="mt-4 rounded-2xl">
          <CardHeader>
            <CardTitle>
              Classement {selectedSailType !== 'Général' ? selectedSailType : ''} {selectedCategory !== 'Général' ? selectedCategory : 'Général'}
              ({discards > 0 ? `après ${discards} discard(s)` : 'sans discard'})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <ol className="space-y-2 md:hidden">
              {overallResults.length ? overallResults.map((result: OverallResult, index: number) => <li key={result.participantId} className="rounded-xl border p-3">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{result.entryName}</p>{result.crewNames.length > 0 && <p className="truncate text-xs text-muted-foreground">{result.crewNames.join(', ')}</p>}</div><div className="text-right"><p className="text-lg font-extrabold tabular-nums">{result.totalPoints}</p><p className="text-xs text-muted-foreground">points</p></div></div>
                <div className="mt-3 flex flex-wrap gap-1.5">{result.scores.map((score, scoreIndex) => <span key={score.heatId} className={cn('rounded-lg bg-muted px-2 py-1 text-xs tabular-nums', score.isDiscarded && 'text-muted-foreground line-through opacity-60')}>{finishedHeats[scoreIndex]?.name}: {score.rank}</span>)}</div>
              </li>) : <li className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Aucun résultat dans cette sélection.</li>}
            </ol>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rang</TableHead>
                    <TableHead>Nom</TableHead>
                    {finishedHeats.map((h: Heat) => (
                      <TableHead key={h.id} className="text-center">{h.name}</TableHead>
                    ))}
                    <TableHead className="text-right">Total Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overallResults.length > 0 ? overallResults.map((result: OverallResult, index: number) => {
                    return (
                      <TableRow key={result.participantId}>
                        <TableCell className="font-bold">{index + 1}</TableCell>
                        <TableCell>
                          <p className="font-medium">{result.entryName}</p>
                          {result.crewNames.length > 0 && (
                            <p className="text-xs text-muted-foreground">{result.crewNames.join(', ')}</p>
                          )}
                        </TableCell>
                         {result.scores.map((score, i) => (
                          <TableCell key={i} className={cn("text-center", score.isDiscarded && "text-muted-foreground line-through")}>
                            {score.rank}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-bold">{result.totalPoints}</TableCell>
                      </TableRow>
                    )
                  }) : (
                    <TableRow>
                      <TableCell colSpan={3 + (finishedHeats.length || 0)} className="text-center text-muted-foreground">
                        Aucun coureur dans cette sélection.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
    </main>
  );
}


    
