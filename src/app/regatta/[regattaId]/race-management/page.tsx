
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

import { View, HeatsAndParticipantsView, HeatDetailView, HeatResultsView, OverallResultsView, type OverallResult } from './views';

const MAX_BIBS = 200;

export default function RaceManagementPage() {
  const params = useParams();
  const regattaId = params.regattaId as string;
  const firestore = useFirestore();

  // Firestore hooks - must be at the top level
  const regattaDocRef = React.useMemo(() => regattaId ? doc(firestore, 'regattas', regattaId) : null, [firestore, regattaId]);
  const { data: regatta, loading: loadingRegatta } = useDoc<Regatta>(regattaDocRef as any);

  const regattaParticipantsColRef = React.useMemo(() => {
      if (!regattaId) return null;
      return collection(firestore, 'regattas', regattaId, 'participants') as CollectionReference<RegattaParticipant>;
  }, [firestore, regattaId]);
  const { data: regattaParticipants, loading: loadingRegattaParticipants } = useCollection<RegattaParticipant>(regattaParticipantsColRef as any);

  const allParticipantsCollection = React.useMemo(() => collection(firestore, 'participants'), [firestore]);
  const { data: allParticipants, loading: loadingAllParticipants } = useCollection<Participant>(allParticipantsCollection as any);

  // State hooks
  const [selectedSailType, setSelectedSailType] = React.useState<'Général' | 'Windsurf' | 'Wingfoil'>('Général');
  const [selectedCategory, setSelectedCategory] = React.useState<'Général' | 'Jeune' | 'Confirmé' | 'Vétéran' | 'Catamaran' | 'Dériveur'>('Général');
  const [discards, setDiscards] = React.useState(0);
  const [numDiscards, setNumDiscards] = React.useState(0);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = React.useState(false);
  const [editingRegattaParticipant, setEditingRegattaParticipant] = React.useState<RegattaParticipant | null>(null);
  const [selectedCrewIds, setSelectedCrewIds] = React.useState<string[]>([]);
  const [selectedBibNumber, setSelectedBibNumber] = React.useState<string>("");
  const [entryName, setEntryName] = React.useState("");
  const [activeHeatId, setActiveHeatId] = React.useState<string | null>(null);
  const [heatCounter, setHeatCounter] = React.useState(1);
  const [timeLeft, setTimeLeft] = React.useState(180);
  const [isTimerActive, setIsTimerActive] = React.useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [currentView, setCurrentView] = React.useState<View>(View.HeatsList);
  const [selectedDuration, setSelectedDuration] = React.useState<string>("180");
  const [isSwapAlertOpen, setIsSwapAlertOpen] = React.useState(false);
  const [swapInfo, setSwapInfo] = React.useState<{ newBib: string } | null>(null);

  // Memoized values
  const activeHeat = React.useMemo(() => regatta?.heats.find((r) => r.id === activeHeatId), [regatta, activeHeatId]);

  const availableBibs = React.useMemo(() => {
    const allBibs = Array.from({ length: MAX_BIBS }, (_, i) => (i + 1).toString());
    if (!regattaParticipants) return allBibs;
    const takenBibs = new Set(regattaParticipants.map(p => p.bibNumber));
    return allBibs.filter(bib => !takenBibs.has(bib));
  }, [regattaParticipants]);

  const getParticipantName = React.useCallback((id: string) => allParticipants?.find(p => p.id === id)?.name ?? 'N/A', [allParticipants]);
  
  const selectedCrewNames = React.useMemo(() => {
    if (!allParticipants || selectedCrewIds.length === 0) {
      return "Ajouter des équipiers";
    }
    if (selectedCrewIds.length === 1) {
      const participant = allParticipants.find(p => p.id === selectedCrewIds[0]);
      return participant ? participant.name : "1 coureur sélectionné";
    }
    return `${selectedCrewIds.length} équipiers sélectionnés`;
  }, [selectedCrewIds, allParticipants]);
  

  const availableParticipantsForRegistration = React.useMemo(() => {
    if (!allParticipants || !regattaParticipants) return [];
    
    // In any mode, a participant can only be in one entry for a given regatta.
    const registeredIds = new Set(regattaParticipants.flatMap(rp => rp.crewIds || []));
    return allParticipants.filter(p => !registeredIds.has(p.id));

  }, [allParticipants, regattaParticipants]);

  const allPossibleBibs = React.useMemo(() => Array.from({ length: MAX_BIBS }, (_, i) => (i + 1).toString()), []);

  const availableBibsForDialog = React.useMemo(() => {
    const takenBibs = new Set(regattaParticipants?.map(p => p.bibNumber) || []);
    if (editingRegattaParticipant) {
        takenBibs.delete(editingRegattaParticipant.bibNumber);
    }
    return allPossibleBibs.filter(bib => !takenBibs.has(bib));
  }, [allPossibleBibs, regattaParticipants, editingRegattaParticipant]);


  const availableCrewForDialog = React.useMemo(() => {
    if (!allParticipants) return [];
    // The crew members of the entry being edited are always available.
    const alreadySelectedCrew = editingRegattaParticipant ? editingRegattaParticipant.crewIds : [];
    
    // All participants in other entries are unavailable.
    const registeredIdsInOtherCrews = new Set(
        regattaParticipants
            ?.filter(rp => rp.id !== editingRegattaParticipant?.id)
            .flatMap(rp => rp.crewIds)
    );

    return allParticipants.filter(p => {
        // If they are in the current entry's crew, they are available.
        if (alreadySelectedCrew.includes(p.id)) return true;
        // If they are in another entry's crew, they are not available.
        return !registeredIdsInOtherCrews.has(p.id);
    });
  }, [allParticipants, regattaParticipants, editingRegattaParticipant]);

  const sortedRegattaParticipants = React.useMemo(() => {
    if(!regattaParticipants) return [];
    return [...regattaParticipants].sort((a, b) => parseInt(a.bibNumber) - parseInt(b.bibNumber));
  }, [regattaParticipants]);

  const sortedHeatResults = React.useMemo(() => {
    if (!activeHeat?.results || !regattaParticipants) return [];
    return [...activeHeat.results].sort((a, b) => {
        const pa = regattaParticipants.find((p: RegattaParticipant) => p.id === a.regattaParticipantId);
        const pb = regattaParticipants.find((p: RegattaParticipant) => p.id === b.regattaParticipantId);
        if (!pa || !pb) return 0;
        return parseInt(pa.bibNumber) - parseInt(pb.bibNumber);
    });
  }, [activeHeat, regattaParticipants]);
  
  // Effects
  React.useEffect(() => {
    if (regatta) {
      setHeatCounter(regatta.heats.length ? Math.max(...regatta.heats.map(h => parseInt(h.id.split('-')[1]))) + 1 : 1);
    }
  }, [regatta]);
  
  React.useEffect(() => {
    if (!isTimerActive) {
      setTimeLeft(Number(selectedDuration));
    }
  }, [selectedDuration, isTimerActive]);

  React.useEffect(() => {
    if (isTimerActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeLeft === 0 && isTimerActive) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsTimerActive(false);

      if (regatta && activeHeat) {
        const updatedHeats = regatta.heats.map(h =>
          h.id === activeHeatId ? { ...h, status: 'In Progress', startTime: Date.now() } : h
        );
        updateRegatta({ heats: updatedHeats as Heat[] });
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerActive, timeLeft, activeHeatId, regatta, activeHeat]);


  // Functions
  const updateRegatta = (updatedData: Partial<Omit<Regatta, 'id'>>) => {
    if (!regattaDocRef) return;
    updateDoc(regattaDocRef, updatedData)
      .catch(err => {
        emitFirestoreError(err, {
          operation: 'update',
          path: regattaDocRef.path,
          requestResourceData: updatedData
        });
      });
  }

  const openEditDialog = (regattaParticipant: RegattaParticipant) => {
    setEditingRegattaParticipant(regattaParticipant);
    setEntryName(regattaParticipant.entryName);
    setSelectedBibNumber(regattaParticipant.bibNumber);
    setSelectedCrewIds(regattaParticipant.crewIds || []);
    setIsRegisterDialogOpen(true);
  }

  const closeRegisterDialog = () => {
    setIsRegisterDialogOpen(false);
    setEditingRegattaParticipant(null);
    setSelectedCrewIds([]);
    setSelectedBibNumber("");
    setEntryName("");
  }
  
  const handleConfirmSwap = async () => {
    if (!swapInfo || !editingRegattaParticipant || !regattaParticipantsColRef || !regattaParticipants) {
        setIsSwapAlertOpen(false);
        return;
    }

    const { newBib } = swapInfo;
    const oldBib = editingRegattaParticipant.bibNumber;
    const otherParticipant = regattaParticipants.find(p => p.bibNumber === newBib);

    if (!otherParticipant) {
        setIsSwapAlertOpen(false);
        return;
    }

    const batch = writeBatch(firestore);

    const currentParticipantRef = doc(regattaParticipantsColRef, editingRegattaParticipant.id);
    const otherParticipantRef = doc(regattaParticipantsColRef, otherParticipant.id);
    
    // Perform the swap
    batch.update(currentParticipantRef, { bibNumber: newBib });
    batch.update(otherParticipantRef, { bibNumber: oldBib });
    
    try {
        await batch.commit();
        closeRegisterDialog();
    } catch (err) {
        // This is a complex operation, logging for now
        console.error("Error swapping bib numbers", err);
    }
    
    setIsSwapAlertOpen(false);
    setSwapInfo(null);
};


  const handleRegisterEntry = () => {
    if (!regattaParticipantsColRef || !selectedBibNumber || !entryName) {
      alert("Veuillez saisir un nom d'inscription et un dossard.");
      return;
    }
    
    // If it's not team mode, at least one crew member (the person themselves) is required.
    if(regatta?.type !== 'individual' && selectedCrewIds.length === 0){
        alert("Veuillez sélectionner au moins un équipier pour une équipe.");
        return;
    }

    const participantData: Omit<RegattaParticipant, 'id'> = { 
        bibNumber: selectedBibNumber,
        crewIds: selectedCrewIds,
        entryName,
    };
    
    if (editingRegattaParticipant) {
      const docRef = doc(regattaParticipantsColRef, editingRegattaParticipant.id);
      
      const isBibTaken = regattaParticipants?.some(p => p.bibNumber === selectedBibNumber && p.id !== editingRegattaParticipant.id);
      if(isBibTaken) {
         setSwapInfo({ newBib: selectedBibNumber });
         setIsSwapAlertOpen(true);
         return; // Wait for user confirmation
      }

      updateDoc(docRef, { ...participantData, bibNumber: selectedBibNumber }).catch(err => {
        emitFirestoreError(err, {
          operation: 'update',
          path: docRef.path,
          requestResourceData: participantData
        })
      })
    } else {
       addDoc(regattaParticipantsColRef, participantData)
        .catch(err => {
            emitFirestoreError(err, {
                operation: 'create',
                path: regattaParticipantsColRef.path,
                requestResourceData: participantData
            });
        });
    }

    closeRegisterDialog();
  };
  
  const handleQuickRegister = (participant: Participant) => {
    if (!regattaParticipantsColRef) return;
    
    const nextBib = availableBibs[0];
    if (!nextBib) {
        alert("Plus de dossards disponibles.");
        return;
    }

    const newRegattaParticipant: Omit<RegattaParticipant, 'id'> = {
        bibNumber: nextBib,
        entryName: participant.name,
        crewIds: [participant.id],
    };
    addDoc(regattaParticipantsColRef, newRegattaParticipant)
        .catch(err => {
            emitFirestoreError(err, {
                operation: 'create',
                path: regattaParticipantsColRef.path,
                requestResourceData: newRegattaParticipant
            });
        });
  };

  const handleDeregister = (regattaParticipantId: string) => {
    if(!regattaParticipantsColRef) return;
    const participantDocRef = doc(regattaParticipantsColRef, regattaParticipantId);
    deleteDoc(participantDocRef)
        .catch(err => {
            emitFirestoreError(err, {
                operation: 'delete',
                path: participantDocRef.path
            });
        });
  }

  const handleAddHeat = () => {
    if (!regatta || !regattaParticipants) return;
    if (regattaParticipants.length === 0) {
      alert("Veuillez d'abord inscrire des participants à la régate via l'onglet 'Participants'.");
      return;
    }
    const newHeatId = `manche-${heatCounter}`;
    const newHeat: Heat = {
      id: newHeatId,
      name: `Manche ${heatCounter}`,
      status: "Not Started",
      startTime: null,
      results: regattaParticipants.map((p) => ({
        regattaParticipantId: p.id,
        passage: { finish: null },
        rank: null,
        points: null,
        status: "DNS",
      })),
    };
    const updatedHeats = [...regatta.heats, newHeat];
    updateRegatta({ heats: updatedHeats });
    setHeatCounter(heatCounter + 1);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes
      .toString()
      .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleStartSequence = () => {
    const duration = Number(selectedDuration);
    if (!activeHeat || activeHeat.status !== "Not Started") {
      return;
    };
    setTimeLeft(duration);
    setIsTimerActive(true);
    // immediate start
    if (duration === 0) {
      if(regatta && activeHeat) {
        const updatedHeats = regatta.heats.map(h => 
          h.id === activeHeatId ? { ...h, status: 'In Progress', startTime: Date.now() } : h
        );
        updateRegatta({ heats: updatedHeats as Heat[] });
      }
      setIsTimerActive(false);
    }
  };

  const handleResetTimer = () => {
    if(!regatta) return;
    setIsTimerActive(false);
    if(timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(Number(selectedDuration));
    const updatedHeats = regatta.heats.map(h => 
      h.id === activeHeatId ? { ...h, status: 'Not Started', startTime: null } : h
    );
    updateRegatta({ heats: updatedHeats as Heat[] });
  };

  const recordFinishTime = (regattaParticipantId: string) => {
    if (!regatta || !activeHeat || activeHeat.status !== "In Progress") return;
  
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  
    const updatedHeats = regatta.heats.map(h => {
      if (h.id === activeHeatId) {
        const updatedResults = h.results.map(res => {
          if (res.regattaParticipantId === regattaParticipantId) {
            // If already finished, toggle to reset
            if (res.passage.finish) {
              return { ...res, passage: { finish: null }, status: "DNS" };
            } else {
              return { ...res, passage: { finish: timestamp }, status: "Finished" };
            }
          }
          return res;
        });
        return { ...h, results: updatedResults };
      }
      return h;
    });
    updateRegatta({ heats: updatedHeats as Heat[] });
  };

  const applyPenalty = (regattaParticipantId: string) => {
    if (!regatta || !activeHeat ) return;

    const updatedHeats = regatta.heats.map(h => {
      if (h.id === activeHeatId) {
        const updatedResults = h.results.map(res => {
          if (res.regattaParticipantId === regattaParticipantId) {
            // Toggle PEN status
            if (res.status === 'PEN') {
              return { ...res, status: "DNS", passage: { finish: null } };
            }
            return { ...res, status: "PEN", passage: { finish: null } };
          }
          return res;
        });
        return { ...h, results: updatedResults };
      }
      return h;
    });
    updateRegatta({ heats: updatedHeats as Heat[] });
  };

  const calculatePoints = () => {
    if (!regatta || !activeHeat || !regattaParticipants) return;

    let finishedCompetitors = activeHeat.results
      .filter((r) => r.status === "Finished" && r.passage.finish)
      .sort((a, b) => a.passage.finish!.localeCompare(b.passage.finish!));

    const penaltyPoints = regattaParticipants.length + 1;

    const updatedResults = activeHeat.results.map((result) => {
      if (result.status === "PEN") {
        return { ...result, rank: null, points: penaltyPoints };
      }
      
      const finishIndex = finishedCompetitors.findIndex(f => f.regattaParticipantId === result.regattaParticipantId);
      
      if (finishIndex !== -1) {
        return { ...result, rank: finishIndex + 1, points: finishIndex + 1 };
      } else {
        return { ...result, rank: null, points: penaltyPoints, status: result.status === 'DNS' ? 'DNS' : 'DNF' };
      }
    });

    const updatedHeats = regatta.heats.map(h => 
      h.id === activeHeatId ? { ...h, results: updatedResults, status: "Finished" } : h
    );
    updateRegatta({ heats: updatedHeats as Heat[] });
    setCurrentView(View.HeatResults);
  };
  
  const calculateOverallResults = (sailType: 'Général' | 'Windsurf' | 'Wingfoil', category: 'Général' | 'Jeune' | 'Confirmé' | 'Vétéran' | 'Catamaran' | 'Dériveur'): OverallResult[] => {
    if (!regatta || !regattaParticipants || !allParticipants) return [];
  
    const finishedHeats = regatta.heats.filter(h => h.status === 'Finished');
    if (finishedHeats.length === 0) return [];
  
    let filteredEntries = regattaParticipants.map(rp => {
        const mainParticipantId = rp.crewIds && rp.crewIds[0];
        const mainParticipant = allParticipants.find(p => p.id === mainParticipantId);
        return { ...rp, mainParticipant };
    });

    if (sailType !== 'Général') {
      filteredEntries = filteredEntries.filter(entry => entry.mainParticipant?.sailType === sailType);
    }
    if (category !== 'Général') {
        filteredEntries = filteredEntries.filter(entry => entry.mainParticipant?.category === category);
    }
  
    if (filteredEntries.length === 0) return [];
  
    const overall: { [regattaParticipantId: string]: Omit<OverallResult, 'participantId'> } = {};
  
    filteredEntries.forEach(rp => {
      const crewNames = (rp.crewIds || []).map(getParticipantName).filter(name => name !== 'N/A');
      overall[rp.id] = { totalPoints: 0, scores: [], entryName: rp.entryName, crewNames };
    });
  
    finishedHeats.forEach(heat => {
      filteredEntries.forEach(rp => {
        const result = heat.results.find(r => r.regattaParticipantId === rp.id);
        const score: Score = {
          heatId: heat.id,
          points: result?.points ?? regattaParticipants.length + 1,
          rank: result?.rank ?? result?.status ?? 'N/A',
          isDiscarded: false,
        };
        if(overall[rp.id]) {
            overall[rp.id].scores.push(score);
        }
      });
    });
  
    Object.keys(overall).forEach(participantId => {
      const participantScores = overall[participantId].scores;
      const sortedScores = [...participantScores].sort((a, b) => b.points - a.points);
  
      for (let i = 0; i < discards; i++) {
        if (sortedScores[i]) {
          const originalScore = participantScores.find(s => s.heatId === sortedScores[i].heatId && s.points === sortedScores[i].points && !s.isDiscarded);
          if(originalScore) originalScore.isDiscarded = true;
        }
      }
  
      overall[participantId].totalPoints = participantScores
        .filter(s => !s.isDiscarded)
        .reduce((acc, s) => acc + s.points, 0);
    });
  
    const finalResults = Object.entries(overall).map(([participantId, data]) => ({
      participantId,
      ...data,
    }));
  
    return finalResults.sort((a, b) => a.totalPoints - b.totalPoints);
  };

  const handleExportCSV = () => {
    if (!regatta || !regattaParticipants) return;
    const overallResults = calculateOverallResults(selectedSailType, selectedCategory);
    const finishedHeats = regatta.heats.filter(h => h.status === 'Finished');

    const BOM = '\uFEFF';

    const headers = ['Rang', 'Équipage', 'Total Points', ...finishedHeats.map(h => h.name)];
    
    const rows = overallResults.map((result, index) => {
        const entryName = result.entryName.includes(',') ? `"${result.entryName}"` : result.entryName;

        const scoreByHeat = finishedHeats.map(h => {
            const score = result.scores.find(s => s.heatId === h.id);
            if (!score) return 'N/A';
            
            const rankText = score.rank?.toString() ?? 'N/A';
            return score.isDiscarded ? `${rankText} (retiré)` : rankText;
        });

        return [
            index + 1,
            entryName,
            result.totalPoints,
            ...scoreByHeat
        ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `resultats-${regatta.name.replace(/\s+/g, '_')}-${selectedSailType}-${selectedCategory}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };
  
  const handleSelectHeat = (heat: Heat) => {
    setActiveHeatId(heat.id);
    if (heat.status === 'Finished') {
      setCurrentView(View.HeatResults);
    } else {
      setCurrentView(View.HeatDetail);
    }
  }


  if (loadingRegatta || loadingAllParticipants || loadingRegattaParticipants) {
    return (
       <main className="flex min-h-[calc(100vh-theme(spacing.14))] flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    )
  }

  if (!regatta) {
    return (
      <main className="flex flex-1 flex-col p-4 md:p-6 items-center justify-center">
          <p className="text-muted-foreground">Régate non trouvée.</p>
          <Link href="/" passHref>
            <Button variant="link">Retour à l'accueil</Button>
          </Link>
      </main>
    );
  }

  const renderContent = () => {
    switch(currentView) {
      case View.HeatDetail:
        return <HeatDetailView 
          activeHeat={activeHeat}
          sortedHeatResults={sortedHeatResults}
          regattaParticipants={regattaParticipants || []}
          isTimerActive={isTimerActive}
          timeLeft={timeLeft}
          selectedDuration={selectedDuration}
          setSelectedDuration={setSelectedDuration}
          handleStartSequence={handleStartSequence}
          handleResetTimer={handleResetTimer}
          calculatePoints={calculatePoints}
          applyPenalty={applyPenalty}
          recordFinishTime={recordFinishTime}
          setCurrentView={setCurrentView}
          formatTime={formatTime}
          getParticipantName={getParticipantName}
        />;
      case View.HeatResults:
        return <HeatResultsView 
          activeHeat={activeHeat}
          regattaParticipants={regattaParticipants || []}
          setCurrentView={setCurrentView}
          getParticipantName={getParticipantName}
        />;
      case View.OverallResults:
        const finishedHeats = regatta?.heats.filter(h => h.status === 'Finished') ?? [];
        return <OverallResultsView
          regatta={regatta}
          finishedHeats={finishedHeats}
          selectedSailType={selectedSailType}
          setSelectedSailType={setSelectedSailType}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          numDiscards={numDiscards}
          setNumDiscards={setNumDiscards}
          discards={discards}
          setDiscards={setDiscards}
          calculateOverallResults={calculateOverallResults}
          handleExportCSV={handleExportCSV}
          setCurrentView={setCurrentView}
        />;
      case View.HeatsList:
      default:
        return <HeatsAndParticipantsView
            regatta={regatta}
            sortedRegattaParticipants={sortedRegattaParticipants}
            allParticipants={allParticipants || []}
            availableParticipantsForRegistration={availableParticipantsForRegistration}
            getParticipantName={getParticipantName}
            handleDeregister={handleDeregister}
            handleQuickRegister={handleQuickRegister}
            openEditDialog={openEditDialog}
            setIsRegisterDialogOpen={setIsRegisterDialogOpen}
            handleAddHeat={handleAddHeat}
            handleSelectHeat={handleSelectHeat}
            setCurrentView={setCurrentView}
          />
    }
  }
  
  const otherParticipantForSwap = swapInfo && regattaParticipants?.find(p => p.bibNumber === swapInfo.newBib);

  return (
    <>
      {renderContent()}
       <Dialog open={isRegisterDialogOpen} onOpenChange={closeRegisterDialog}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>{editingRegattaParticipant ? "Modifier l'inscription" : "Nouvelle Inscription"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="entryName">Nom de l'inscription / Équipe</Label>
                    <Input id="entryName" value={entryName} onChange={(e) => setEntryName(e.target.value)} placeholder="Ex: Team Voile, Nom du coureur..." />
                </div>
                 <div className="space-y-2">
                    <Label>Dossard</Label>
                    <Select value={selectedBibNumber} onValueChange={setSelectedBibNumber}>
                        <SelectTrigger>
                            <SelectValue placeholder="Choisir un dossard" />
                        </SelectTrigger>
                        <SelectContent>
                             {allPossibleBibs.map(bib => {
                                const participantWithBib = regattaParticipants?.find(p => p.bibNumber === bib && p.id !== editingRegattaParticipant?.id);
                                return (
                                    <SelectItem key={bib} value={bib}>
                                        {bib} {participantWithBib ? `(pris par ${participantWithBib.entryName})` : '(disponible)'}
                                    </SelectItem>
                                )
                            })}
                        </SelectContent>
                    </Select>
                </div>
                
                 {regatta?.type !== 'individual' && (
                    <div className="space-y-2">
                        <Label>Équipier(s)</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start font-normal">
                                    <Plus className="mr-2 h-4 w-4" />
                                    {selectedCrewNames}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Command>
                                    <CommandInput placeholder="Rechercher un coureur..." />
                                    <CommandList>
                                    <CommandEmpty>Aucun coureur trouvé.</CommandEmpty>
                                    <CommandGroup>
                                    {availableCrewForDialog.map((participant) => (
                                        <CommandItem
                                            key={participant.id}
                                            value={participant.name}
                                            onSelect={() => {
                                                setSelectedCrewIds(prev => 
                                                    prev.includes(participant.id)
                                                    ? prev.filter(id => id !== participant.id)
                                                    : [...prev, participant.id]
                                                )
                                            }}
                                        >
                                            <CheckCircle
                                                className={cn("mr-2 h-4 w-4", selectedCrewIds.includes(participant.id) ? "opacity-100" : "opacity-0")}
                                            />
                                            {participant.name}
                                        </CommandItem>
                                    ))}
                                    </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                 )}
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={closeRegisterDialog}>Annuler</Button>
                <Button type="submit" onClick={handleRegisterEntry}>{editingRegattaParticipant ? "Enregistrer" : "Inscrire"}</Button>
            </DialogFooter>
        </DialogContent>
       </Dialog>
       
        <AlertDialog open={isSwapAlertOpen} onOpenChange={setIsSwapAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Permuter les dossards ?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Le dossard {swapInfo?.newBib} est déjà attribué à {otherParticipantForSwap?.entryName}. Voulez-vous leur attribuer le dossard {editingRegattaParticipant?.bibNumber} en échange ?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsSwapAlertOpen(false)}>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmSwap}>Permuter</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

    </>
  );
}
