
"use client";

import * as React from "react";
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
import type { Heat, Regatta, Participant, RegattaParticipant, Score, CompetitorRaceResult } from "@/lib/types";
import { useFirestore, useDoc, useCollection } from "@/firebase";
import { emitFirestoreError } from "@/firebase/errors";
import { NumberStepper } from "@/components/ui/number-stepper";
import { ScrollArea } from "@/components/ui/scroll-area";


export enum View { HeatsList, HeatDetail, HeatResults, OverallResults }
export type OverallResult = { participantId: string; totalPoints: number; scores: Score[]; entryName: string; crewNames: string[]; }


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
    <Card ref={setNodeRef} style={style} className="p-3 touch-none">
      <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 flex-1 min-w-0">
              <Button variant="ghost" size="icon" className="h-8 w-8 cursor-grab" {...attributes} {...listeners}>
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
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(rp)}>
                <FileEdit className="h-4 w-4"/>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeregister(rp.id)}>
                <Trash2 className="h-4 w-4 text-destructive"/>
            </Button>
          </div>
      </div>
    </Card>
  );
}


export const HeatsAndParticipantsView = ({ regatta, sortedRegattaParticipants, allParticipants, availableParticipantsForRegistration, getParticipantName, handleDeregister, handleQuickRegister, openEditDialog, setIsRegisterDialogOpen, handleAddHeat, handleSelectHeat, setCurrentView }: any) => {
  const isTeamMode = regatta.type === 'team' || regatta.type === 'mixed';
  const firestore = useFirestore();

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
    <main className="flex flex-1 flex-col p-4 md:p-6 relative">
      <div className="flex items-center gap-4 mb-6">
         <Link href="/" passHref><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5"/></Button></Link>
         <h1 className="text-2xl font-bold">{regatta?.name}</h1>
      </div>
       <Tabs defaultValue="participants" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="heats">Manches</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
        </TabsList>
        <TabsContent value="heats">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
             <Button variant="outline" onClick={handleAddHeat}>
              <Plus className="h-4 w-4 mr-2"/>
              Ajouter une manche
            </Button>
            <Button onClick={() => setCurrentView(View.OverallResults)} disabled={(regatta?.heats.filter((h: Heat) => h.status === 'Finished').length ?? 0) === 0}>
              <Trophy className="h-4 w-4 mr-2"/>
              Classement Général
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {regatta?.heats.map((heat: Heat) => (
              <Card 
                key={heat.id} 
                className="p-4 cursor-pointer hover:bg-accent"
                onClick={() => handleSelectHeat(heat)}
              >
                 <CardHeader className="p-0 mb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flag className="h-5 w-5 text-muted-foreground"/>
                      <CardTitle className="text-lg">{heat.name}</CardTitle>
                    </div>
                     <Button variant="ghost" size="sm">Gérer</Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <p className={cn("text-sm",
                      heat.status === "In Progress" && "text-green-500",
                      heat.status === "Finished" && "text-blue-500",
                      heat.status === "Not Started" && "text-muted-foreground"
                    )}>
                      {heat.status === 'Not Started' ? 'En attente' : heat.status === 'In Progress' ? 'En cours' : 'Terminée'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
             {regatta?.heats.length === 0 && (
              <p className="text-muted-foreground col-span-1 md:col-span-2 text-center mt-4">Aucune manche créée pour le moment.</p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="participants">
           <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5"/>
                      Inscrits à la Régate ({sortedRegattaParticipants?.length ?? 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isTeamMode && (
                        <Button onClick={() => setIsRegisterDialogOpen(true)} className="w-full mb-4">
                            <UserPlus className="h-4 w-4 mr-2"/> Inscrire une Équipe
                        </Button>
                    )}
                    <ScrollArea className="h-[50vh] pr-4">
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
                            <div className="p-4 text-center text-muted-foreground">
                              Aucun coureur inscrit pour cette régate.
                            </div>
                         )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
              
              <div>
                 <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5"/>
                      Base de Données Coureurs ({availableParticipantsForRegistration?.length ?? 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[calc(50vh+52px)] pr-4">
                      <div className="space-y-2">
                        {availableParticipantsForRegistration.map((p: Participant) => (
                          <Card key={p.id} className="p-3">
                            <div className="flex justify-between items-center">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{p.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{p.club} - {p.sailType}</p>
                              </div>
                              {!isTeamMode && (
                                <Button size="sm" variant="outline" onClick={() => handleQuickRegister(p)}>
                                  <Plus className="h-4 w-4 mr-2"/>
                                  Inscrire
                                </Button>
                              )}
                            </div>
                          </Card>
                        ))}
                         {availableParticipantsForRegistration.length === 0 && (
                            <div className="p-4 text-center text-muted-foreground">
                              Tous les coureurs de la base de données sont inscrits.
                            </div>
                         )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                 </Card>
              </div>
           </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}

export const HeatDetailView = ({ activeHeat, sortedHeatResults, regattaParticipants, isTimerActive, timeLeft, selectedDuration, setSelectedDuration, handleStartSequence, handleResetTimer, calculatePoints, applyPenalty, recordFinishTime, setCurrentView, formatTime, getParticipantName }: any) => {
  
  return (
     <main className="flex flex-1 flex-col h-screen">
      <div className="flex items-center p-4 border-b flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setCurrentView(View.HeatsList)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-center flex-1">{activeHeat?.name} - Arrivées</h1>
      </div>

      {activeHeat?.status !== 'Finished' && (
        <div className="bg-card p-4 border-b flex-shrink-0">
           <div className="text-center">
              <div
                className={cn(
                  "font-mono font-bold text-5xl my-2 tabular-nums text-foreground",
                  isTimerActive && timeLeft > 0 && "text-green-500",
                  isTimerActive && timeLeft <= 10 && "text-destructive animate-pulse"
                )}
              >
                {formatTime(timeLeft)}
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 mb-4">
               <Select onValueChange={setSelectedDuration} defaultValue={selectedDuration} disabled={isTimerActive || activeHeat?.status !== 'Not Started'}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Temps de départ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Immédiat</SelectItem>
                    <SelectItem value="30">30 secondes</SelectItem>
                    <SelectItem value="60">1 minute</SelectItem>
                    <SelectItem value="180">3 minutes</SelectItem>
                    <SelectItem value="300">5 minutes</SelectItem>
                  </SelectContent>
                </Select>
              <Button size="lg" className="h-12 px-6 text-base" onClick={handleStartSequence} disabled={isTimerActive || activeHeat?.status !== 'Not Started'} >
                  Lancer Séquence
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-4" onClick={handleResetTimer}>
                  <RefreshCw className="h-5 w-5" />
              </Button>
            </div>
        </div>
      )}
       {activeHeat?.status === 'In Progress' && (
            <div className="p-4 flex-shrink-0">
              <Button onClick={calculatePoints} className="w-full">
                <ListOrdered className="mr-2 h-4 w-4" />
                Terminer et Calculer les Résultats
              </Button>
            </div>
          )}
           {activeHeat?.status === 'Finished' && (
            <div className="p-4 flex-shrink-0">
            <Button onClick={() => setCurrentView(View.HeatResults)} className="w-full" >
              <ListOrdered className="mr-2 h-4 w-4" />
              Voir les Résultats
            </Button>
            </div>
          )}
      
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-4">
          {sortedHeatResults.map((result: any) => {
              const regattaParticipant = regattaParticipants.find((p:RegattaParticipant) => p.id === result.regattaParticipantId);
              if(!regattaParticipant) return null;
              const hasFinished = !!result.passage.finish;
              const isPenalized = result.status === 'PEN';

              return (
                <Card key={regattaParticipant.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3  flex-1 min-w-0">
                    <Badge variant="secondary" className="text-base font-bold h-8 w-12 flex-shrink-0 flex items-center justify-center">{regattaParticipant.bibNumber}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base truncate">{regattaParticipant.entryName}</p>
                      {regattaParticipant.crewIds && regattaParticipant.crewIds.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate">
                          {regattaParticipant.crewIds.map(getParticipantName).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="destructive"
                      className={cn(
                        "h-10 w-10 p-0",
                        isPenalized ? "bg-red-700 hover:bg-red-600" : "bg-red-500/50 hover:bg-red-500/80"
                      )}
                      onClick={() => applyPenalty(regattaParticipant.id)}
                      disabled={activeHeat?.status === 'Finished'}
                    >
                      <ShieldAlert className="h-5 w-5" />
                    </Button>
                    <Button
                      size="lg"
                      className={cn(
                        "h-10 w-32 text-sm", 
                        hasFinished ? "bg-gray-600 hover:bg-gray-500" : "bg-primary hover:bg-primary/90 shadow-[0_0_15px_hsl(var(--primary))]",
                        isPenalized && "bg-gray-600 hover:bg-gray-500 line-through"
                      )}
                      onClick={() => recordFinishTime(regattaParticipant.id)}
                      disabled={isPenalized || activeHeat?.status !== 'In Progress'}
                    >
                      {hasFinished ? `Annuler (${result.passage.finish})` : isPenalized ? 'Pénalité' : 'Arrivée'}
                    </Button>
                  </div>
                </Card>
              );
            })}
        </div>
      </ScrollArea>
    </main>
  );
}

export const HeatResultsView = ({ activeHeat, regattaParticipants, setCurrentView, getParticipantName }: any) => {
  const sortedResults = React.useMemo(() => {
    if (!activeHeat?.results) return [];
    return [...activeHeat.results].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  }, [activeHeat]);

  return (
    <main className="flex flex-1 flex-col p-4 md:p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setCurrentView(View.HeatsList)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Résultats - {activeHeat?.name}</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Classement de la Manche</CardTitle>
        </CardHeader>
        <CardContent>
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
          <h1 className="text-xl font-bold">Classement Général - {regatta?.name}</h1>
        </div>
         <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={overallResults.length === 0}>
          <FileDown className="h-4 w-4 mr-2" />
          Exporter en CSV
        </Button>
      </div>
      <Card className="mb-4">
        <CardHeader>
            <CardTitle className="text-lg">Calcul des Discards</CardTitle>
            <CardDescription>Retirer les moins bonnes manches du calcul final.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
           <Label htmlFor="discards-input" className="whitespace-nowrap text-sm text-muted-foreground">Manches à retirer :</Label>
            <NumberStepper 
              id="discards-input"
              value={numDiscards}
              onChange={setNumDiscards}
              min={0}
              max={finishedHeats.length > 0 ? finishedHeats.length -1 : 0}
            />
            <Button size="sm" onClick={() => setDiscards(numDiscards)}>
              <Calculator className="h-4 w-4 mr-2" />
              Appliquer
            </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
          <Tabs value={selectedSailType} onValueChange={(value) => setSelectedSailType(value as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="Général">Général</TabsTrigger>
                <TabsTrigger value="Windsurf">Windsurf</TabsTrigger>
                <TabsTrigger value="Wingfoil">Wingfoil</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="Général">Général</TabsTrigger>
                <TabsTrigger value="Jeune">Jeune</TabsTrigger>
                <TabsTrigger value="Confirmé">Confirmé</TabsTrigger>
                <TabsTrigger value="Vétéran">Vétéran</TabsTrigger>
                <TabsTrigger value="Catamaran">Catamaran</TabsTrigger>
                <TabsTrigger value="Dériveur">Dériveur</TabsTrigger>
            </TabsList>
          </Tabs>
      </div>
      
         <Card className="mt-4">
          <CardHeader>
            <CardTitle>
              Classement {selectedSailType !== 'Général' ? selectedSailType : ''} {selectedCategory !== 'Général' ? selectedCategory : 'Général'}
              ({discards > 0 ? `après ${discards} discard(s)` : 'sans discard'})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
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


    