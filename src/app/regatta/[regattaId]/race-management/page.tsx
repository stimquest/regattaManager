
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
import { participantDisplayName, participantSearchText, splitFullName, type Heat, type Regatta, type Participant, type RegattaParticipant, type Score, type CompetitorRaceResult, type ScoringRules, type PenaltyScoreRule } from "@/lib/types";
import { useFirestore, useDoc, useCollection } from "@/firebase";
import { emitFirestoreError } from "@/firebase/errors";
import { NumberStepper } from "@/components/ui/number-stepper";
import { ScrollArea } from "@/components/ui/scroll-area";

import { View, HeatsAndParticipantsView, HeatDetailView, HeatResultsView, OverallResultsView, ScoringSettingsView, type OverallResult } from './views';

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
  const [registrationSearch, setRegistrationSearch] = React.useState("");
  const [fastSelectedParticipantId, setFastSelectedParticipantId] = React.useState("");
  const [isCreatingParticipant, setIsCreatingParticipant] = React.useState(false);
  const [newParticipantFirstName, setNewParticipantFirstName] = React.useState("");
  const [newParticipantLastName, setNewParticipantLastName] = React.useState("");
  const [newParticipantClub, setNewParticipantClub] = React.useState("");
  const [newParticipantLicense, setNewParticipantLicense] = React.useState("");
  const [newParticipantCategory, setNewParticipantCategory] = React.useState<Participant['category']>('Confirmé');
  const [newParticipantSailType, setNewParticipantSailType] = React.useState<Participant['sailType']>('Windsurf');
  const [newParticipantProfile, setNewParticipantProfile] = React.useState<NonNullable<Participant['profileType']>>('unclassified');
  const [fastRegisterBusy, setFastRegisterBusy] = React.useState(false);
  const [activeHeatId, setActiveHeatId] = React.useState<string | null>(null);
  const [heatCounter, setHeatCounter] = React.useState(1);
  const [timeLeft, setTimeLeft] = React.useState(180);
  const [isTimerActive, setIsTimerActive] = React.useState(false);
  const [entryMode, setEntryMode] = React.useState<'live' | 'paper'>('paper');
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [currentView, setCurrentView] = React.useState<View>(View.HeatsList);
  const [selectedDuration, setSelectedDuration] = React.useState<string>("180");
  const [isSwapAlertOpen, setIsSwapAlertOpen] = React.useState(false);
  const [swapInfo, setSwapInfo] = React.useState<{ newBib: string } | null>(null);

  // Memoized values
  const activeHeat = React.useMemo(() => regatta?.heats.find((r) => r.id === activeHeatId), [regatta, activeHeatId]);

  const scoringRules: ScoringRules = regatta?.scoringRules ?? {
    pen: { mode: 'fleetPlus', offset: 1 },
    dns: { mode: 'fleetPlus', offset: 1 },
    dnf: { mode: 'fleetPlus', offset: 1 },
    discards: 0,
  };
  React.useEffect(() => {
    if (regatta) {
      const value = regatta.scoringRules?.discards ?? 0;
      setDiscards(value);
      setNumDiscards(value);
    }
  }, [regatta?.id]);

  const availableBibs = React.useMemo(() => {
    const allBibs = Array.from({ length: MAX_BIBS }, (_, i) => (i + 1).toString());
    if (!regattaParticipants) return allBibs;
    const takenBibs = new Set(regattaParticipants.map(p => p.bibNumber));
    return allBibs.filter(bib => !takenBibs.has(bib));
  }, [regattaParticipants]);

  const getParticipantName = React.useCallback((id: string) => {
    const participant = allParticipants?.find(p => p.id === id);
    return participant ? participantDisplayName(participant) : 'N/A';
  }, [allParticipants]);
  
  const selectedCrewNames = React.useMemo(() => {
    if (!allParticipants || selectedCrewIds.length === 0) {
      return "Ajouter des équipiers";
    }
    if (selectedCrewIds.length === 1) {
      const participant = allParticipants.find(p => p.id === selectedCrewIds[0]);
      return participant ? participantDisplayName(participant) : "1 coureur sélectionné";
    }
    return `${selectedCrewIds.length} équipiers sélectionnés`;
  }, [selectedCrewIds, allParticipants]);
  

  const availableParticipantsForRegistration = React.useMemo(() => {
    if (!allParticipants || !regattaParticipants) return [];
    
    // In any mode, a participant can only be in one entry for a given regatta.
    const registeredIds = new Set(regattaParticipants.flatMap(rp => rp.crewIds || []));
    return allParticipants.filter(p => !registeredIds.has(p.id));

  }, [allParticipants, regattaParticipants]);

  const matchingRegistrationParticipants = React.useMemo(() => {
    const needle = registrationSearch.trim().toLocaleLowerCase('fr-FR');
    return (allParticipants ?? [])
      .filter(person => `${participantSearchText(person)} ${person.club} ${person.licenseNumber}`.toLocaleLowerCase('fr-FR').includes(needle))
      .sort((a, b) => Number(b.profileType === 'annualMember') - Number(a.profileType === 'annualMember') || participantDisplayName(a).localeCompare(participantDisplayName(b), 'fr'))
      .slice(0, 8);
  }, [allParticipants, registrationSearch]);

  const registeredParticipantIds = React.useMemo(() => new Set(regattaParticipants?.flatMap(entry => entry.crewIds ?? []) ?? []), [regattaParticipants]);
  const fastSelectedParticipant = allParticipants?.find(person => person.id === fastSelectedParticipantId);

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

  const updateScoringRules = (rules: ScoringRules) => {
    setDiscards(rules.discards);
    setNumDiscards(rules.discards);
    updateRegatta({ scoringRules: rules });
  };
  const setAndSaveDiscards = (value: number) => {
    setDiscards(value);
    setNumDiscards(value);
    updateScoringRules({ ...scoringRules, discards: value });
  };

  const penaltyPointsFor = (rule: PenaltyScoreRule, fleetSize: number) =>
    rule.mode === 'fixed' ? rule.points : fleetSize + rule.offset;

  const calculateRows = (results: CompetitorRaceResult[]) => {
    const finishers = results
      .filter(result => result.status === 'Finished' && (result.arrivalOrder != null || result.passage.finish))
      .sort((a, b) => a.arrivalOrder != null && b.arrivalOrder != null
        ? a.arrivalOrder - b.arrivalOrder
        : a.arrivalOrder != null ? -1 : b.arrivalOrder != null ? 1
        : (a.passage.finish ?? '').localeCompare(b.passage.finish ?? ''));
    return results.map(result => {
      if (result.status === 'PEN') return { ...result, rank: null, points: penaltyPointsFor(scoringRules.pen, regattaParticipants?.length ?? 0) };
      const rank = finishers.findIndex(finisher => finisher.regattaParticipantId === result.regattaParticipantId);
      if (rank >= 0) return { ...result, rank: rank + 1, points: rank + 1 };
      const status: 'DNS' | 'DNF' = result.status === 'DNS' ? 'DNS' : 'DNF';
      return { ...result, status, rank: null, points: penaltyPointsFor(scoringRules[status.toLowerCase() as 'dns' | 'dnf'], regattaParticipants?.length ?? 0) };
    });
  };

  const persistArrivalRows = async (results: CompetitorRaceResult[]) => {
    if (!regattaDocRef || !regatta || !activeHeatId) throw new Error('Manche indisponible');
    const heats = regatta.heats.map(heat => heat.id !== activeHeatId ? heat : {
      ...heat,
      status: heat.status === 'Not Started' && results.some(row => row.status === 'Finished') ? 'In Progress' as const : heat.status,
      results: heat.status === 'Finished' ? calculateRows(results) : results,
    });
    await updateDoc(regattaDocRef, { heats });
  };

  const validateArrivalRows = async (results: CompetitorRaceResult[]) => {
    if (!regattaDocRef || !regatta || !activeHeatId) throw new Error('Manche indisponible');
    await updateDoc(regattaDocRef, { heats: regatta.heats.map(heat => heat.id === activeHeatId
      ? { ...heat, status: 'Finished', results: calculateRows(results) } : heat) });
    setCurrentView(View.HeatResults);
  };

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
    setRegistrationSearch("");
    setFastSelectedParticipantId("");
    setIsCreatingParticipant(false);
    setNewParticipantFirstName("");
    setNewParticipantLastName("");
    setNewParticipantClub("");
    setNewParticipantLicense("");
    setNewParticipantProfile('unclassified');
  }

  const startRegistration = (participant?: Participant) => {
    setEditingRegattaParticipant(null);
    setSelectedCrewIds([]);
    setEntryName("");
    setSelectedBibNumber("");
    setFastSelectedParticipantId(participant?.id ?? "");
    setRegistrationSearch(participant ? participantDisplayName(participant) : "");
    setIsCreatingParticipant(false);
    setIsRegisterDialogOpen(true);
  };
  
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
  
  const handleQuickRegister = (participant: Participant) => startRegistration(participant);

  const handleFastRegistration = async () => {
    const rawBib = selectedBibNumber.trim();
    const bib = String(Number(rawBib));
    if (!regattaParticipantsColRef || !regattaParticipants || !bib || fastRegisterBusy) return;
    if (!/^\d{1,3}$/.test(bib) || Number(bib) < 1 || Number(bib) > MAX_BIBS) {
      alert(`Saisissez un dossard entre 1 et ${MAX_BIBS}.`);
      return;
    }
    if (regattaParticipants.some(entry => entry.bibNumber === bib)) {
      alert(`Le dossard ${bib} est déjà attribué dans cette régate.`);
      return;
    }

    let participant = availableParticipantsForRegistration.find(person => person.id === fastSelectedParticipantId);
    if (isCreatingParticipant) {
      const firstName = newParticipantFirstName.trim();
      const lastName = newParticipantLastName.trim();
      const club = newParticipantClub.trim();
      if (firstName.length < 2 || lastName.length < 2 || club.length < 2) {
        alert('Saisissez le prénom, le nom et le club du coureur.');
        return;
      }
      const participantRef = doc(collection(firestore, 'participants'));
      const entryRef = doc(regattaParticipantsColRef);
      const newParticipant = {
        firstName,
        lastName,
        club,
        licenseNumber: newParticipantLicense.trim(),
        category: newParticipantCategory,
        sailType: newParticipantSailType,
        profileType: newParticipantProfile,
      };
      const batch = writeBatch(firestore);
      batch.set(participantRef, newParticipant);
      batch.set(entryRef, { bibNumber: bib, entryName: `${firstName} ${lastName}`, crewIds: [participantRef.id] } as RegattaParticipant);
      setFastRegisterBusy(true);
      try {
        await batch.commit();
        setFastSelectedParticipantId('');
        setRegistrationSearch('');
        setIsCreatingParticipant(false);
        setNewParticipantFirstName('');
        setNewParticipantLastName('');
        setNewParticipantClub('');
        setNewParticipantLicense('');
        setNewParticipantProfile('unclassified');
        setSelectedBibNumber(String(Math.min(Number(bib) + 1, MAX_BIBS)));
      } catch (error) {
        emitFirestoreError(error, { operation: 'create', path: regattaParticipantsColRef.path });
      } finally {
        setFastRegisterBusy(false);
      }
      return;
    }

    if (!participant) {
      alert('Choisissez un coureur déjà enregistré, ou créez une nouvelle fiche.');
      return;
    }
    setFastRegisterBusy(true);
    try {
      await addDoc(regattaParticipantsColRef, { bibNumber: bib, entryName: participantDisplayName(participant), crewIds: [participant.id] } as RegattaParticipant);
      setFastSelectedParticipantId('');
      setRegistrationSearch('');
      setSelectedBibNumber(String(Math.min(Number(bib) + 1, MAX_BIBS)));
    } catch (error) {
      emitFirestoreError(error, { operation: 'create', path: regattaParticipantsColRef.path });
    } finally {
      setFastRegisterBusy(false);
    }
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
    if (!activeHeat || activeHeat.status !== 'Not Started') return;
    setIsTimerActive(false);
    if(timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(Number(selectedDuration));
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
          points: result?.points ?? penaltyPointsFor(scoringRules[result?.status?.toLowerCase() as 'pen' | 'dns' | 'dnf'] ?? scoringRules.dns, regattaParticipants.length),
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
          persistArrivalRows={persistArrivalRows}
          validateArrivalRows={validateArrivalRows}
          activeHeat={activeHeat}
          regattaParticipants={regattaParticipants || []}
          isTimerActive={isTimerActive}
          timeLeft={timeLeft}
          selectedDuration={selectedDuration}
          setSelectedDuration={setSelectedDuration}
          handleStartSequence={handleStartSequence}
          handleResetTimer={handleResetTimer}
          entryMode={entryMode}
          setEntryMode={setEntryMode}
          setCurrentView={setCurrentView}
          formatTime={formatTime}
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
          setDiscards={setAndSaveDiscards}
          calculateOverallResults={calculateOverallResults}
          handleExportCSV={handleExportCSV}
          setCurrentView={setCurrentView}
        />;
      case View.ScoringSettings:
        return <ScoringSettingsView regatta={{ ...regatta, scoringRules }} updateScoringRules={updateScoringRules} setCurrentView={setCurrentView} />;
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
            startRegistration={startRegistration}
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
        <DialogContent className="max-h-[calc(100dvh-1rem)] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl p-4 sm:max-h-[90dvh] sm:overflow-y-auto sm:p-6">
            <DialogHeader>
                <DialogTitle>{editingRegattaParticipant ? "Modifier l'inscription" : regatta?.type === 'individual' ? "Inscrire un coureur" : "Inscrire une équipe"}</DialogTitle>
            </DialogHeader>
            {regatta?.type === 'individual' && !editingRegattaParticipant ? (
              <div className="min-h-0 min-w-0 space-y-5 overflow-y-auto overscroll-contain py-2">
                <p className="text-sm text-muted-foreground">Le dossard a déjà été remis : saisis son numéro, puis retrouve le coureur ou crée sa fiche.</p>
                <div className="space-y-2">
                  <Label htmlFor="assignedBib">Dossard remis</Label>
                  <Input id="assignedBib" autoFocus inputMode="numeric" type="number" min="1" max={MAX_BIBS} className="h-14 text-xl font-bold tabular-nums" placeholder="Ex. 24" value={selectedBibNumber} onChange={event => setSelectedBibNumber(event.target.value)} />
                </div>
                {!isCreatingParticipant ? (
                  <div className="min-w-0 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="registrationSearch">Retrouver le coureur</Label>
                      <Input id="registrationSearch" autoComplete="off" className="h-12" placeholder="Nom, club ou licence" value={registrationSearch} onChange={event => { setRegistrationSearch(event.target.value); setFastSelectedParticipantId(''); }} />
                    </div>
                    {fastSelectedParticipantId ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-primary bg-primary/5 p-3">
                        <div className="min-w-0"><p className="font-semibold">{fastSelectedParticipant ? participantDisplayName(fastSelectedParticipant) : ''}</p><p className="text-sm text-muted-foreground">{fastSelectedParticipant?.club}</p></div>
                        <Button type="button" variant="ghost" onClick={() => setFastSelectedParticipantId('')}>Changer</Button>
                      </div>
                    ) : (
                      <div className="max-h-52 min-w-0 space-y-2 overflow-x-hidden overflow-y-auto">
                        {matchingRegistrationParticipants.map(person => (
                          <button type="button" key={person.id} disabled={registeredParticipantIds.has(person.id)} onClick={() => { setFastSelectedParticipantId(person.id); setRegistrationSearch(participantDisplayName(person)); }} className="flex min-h-14 w-full min-w-0 items-center justify-between gap-2 rounded-xl border p-3 text-left hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-70">
                            <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{participantDisplayName(person)}</span><span className="block truncate text-sm text-muted-foreground">{person.club} · {person.sailType}{person.licenseNumber ? ` · Licence ${person.licenseNumber}` : ''}</span></span>
                            <span className="w-16 shrink-0 break-words text-right text-xs font-medium leading-tight text-primary">{registeredParticipantIds.has(person.id) ? 'Déjà inscrit' : 'Choisir'}</span>
                          </button>
                        ))}
                        {matchingRegistrationParticipants.length === 0 && <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Aucun coureur libre ne correspond.</p>}
                      </div>
                    )}
                    <Button type="button" variant="outline" className="h-12 w-full" onClick={() => { const nameParts = splitFullName(registrationSearch); setIsCreatingParticipant(true); setNewParticipantFirstName(nameParts.firstName); setNewParticipantLastName(nameParts.lastName); setFastSelectedParticipantId(''); }}>
                      <UserPlus className="mr-2 h-4 w-4"/> Créer une nouvelle fiche
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                    <div className="flex items-center justify-between"><h3 className="font-semibold">Nouvelle fiche coureur</h3><Button type="button" variant="ghost" onClick={() => setIsCreatingParticipant(false)}>Retour à la recherche</Button></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2"><Label htmlFor="newRunnerFirstName">Prénom *</Label><Input id="newRunnerFirstName" autoFocus autoComplete="given-name" className="h-12" value={newParticipantFirstName} onChange={event => setNewParticipantFirstName(event.target.value)} /></div>
                      <div className="space-y-2"><Label htmlFor="newRunnerLastName">Nom *</Label><Input id="newRunnerLastName" autoComplete="family-name" className="h-12" value={newParticipantLastName} onChange={event => setNewParticipantLastName(event.target.value)} /></div>
                      <div className="space-y-2"><Label htmlFor="newRunnerClub">Club *</Label><Input id="newRunnerClub" className="h-12" placeholder="Club ou indépendant" value={newParticipantClub} onChange={event => setNewParticipantClub(event.target.value)} /></div>
                      <div className="space-y-2"><Label htmlFor="newRunnerLicense">Licence (facultatif)</Label><Input id="newRunnerLicense" className="h-12" value={newParticipantLicense} onChange={event => setNewParticipantLicense(event.target.value)} /></div>
                      <div className="space-y-2"><Label>Profil</Label><Select value={newParticipantProfile} onValueChange={value => setNewParticipantProfile(value as NonNullable<Participant['profileType']>)}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="annualMember">Membre à l’année</SelectItem><SelectItem value="vacationRegular">Habitué vacances</SelectItem><SelectItem value="visitor">Visiteur / autre club</SelectItem><SelectItem value="unclassified">À classer</SelectItem></SelectContent></Select></div>
                      <div className="space-y-2"><Label>Catégorie</Label><Select value={newParticipantCategory} onValueChange={value => setNewParticipantCategory(value as Participant['category'])}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Jeune">Jeune</SelectItem><SelectItem value="Confirmé">Confirmé</SelectItem><SelectItem value="Vétéran">Vétéran</SelectItem><SelectItem value="Catamaran">Catamaran</SelectItem><SelectItem value="Dériveur">Dériveur</SelectItem></SelectContent></Select></div>
                      <div className="space-y-2"><Label>Support</Label><Select value={newParticipantSailType} onValueChange={value => setNewParticipantSailType(value as Participant['sailType'])}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Windsurf">Windsurf</SelectItem><SelectItem value="Wingfoil">Wingfoil</SelectItem><SelectItem value="Catamaran">Catamaran</SelectItem><SelectItem value="Dinghy">Dériveur</SelectItem></SelectContent></Select></div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="min-h-0 min-w-0 space-y-5 overflow-y-auto overscroll-contain py-2">
                <div className="space-y-2">
                    <Label htmlFor="entryName">Nom de l'inscription / Équipe</Label>
                    <Input className="h-12" id="entryName" value={entryName} onChange={(e) => setEntryName(e.target.value)} placeholder="Nom du coureur ou de l’équipe" />
                </div>
                 <div className="space-y-2">
                    <Label>Dossard</Label>
                    <Select value={selectedBibNumber} onValueChange={setSelectedBibNumber}>
                        <SelectTrigger className="h-12">
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
                                    <Button variant="outline" className="h-auto min-h-12 w-full justify-start whitespace-normal py-3 text-left font-normal">
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
                                            value={participantDisplayName(participant)}
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
                                            {participantDisplayName(participant)}
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
            )}
            <DialogFooter className="min-w-0 flex-col-reverse gap-2 pt-2 sm:flex-row">
                {regatta?.type === 'individual' && !editingRegattaParticipant ? <>
                  <Button className="h-12" type="button" variant="outline" onClick={closeRegisterDialog}>Terminer</Button>
                  <Button className="h-12" type="button" disabled={fastRegisterBusy || (!fastSelectedParticipantId && !isCreatingParticipant)} onClick={() => void handleFastRegistration()}>{fastRegisterBusy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Enregistrement…</> : 'Inscrire et suivant'}</Button>
                </> : <>
                <Button className="h-12" type="button" variant="outline" onClick={closeRegisterDialog}>Annuler</Button>
                <Button className="h-12" type="submit" onClick={handleRegisterEntry}>{editingRegattaParticipant ? "Enregistrer" : "Inscrire"}</Button>
                </>}
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
