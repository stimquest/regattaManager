"use client";

import * as React from "react";
import Papa from "papaparse";
import { collection, addDoc, updateDoc, doc, writeBatch, getDocs, query, where, deleteField, type WriteBatch } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Trash2, UserPlus, Loader2, Upload, Search, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ParticipantForm } from '@/app/participants/participant-form';
import { participantDisplayName, participantSearchText, splitFullName, type Participant } from "@/lib/types";
import { useFirestore, useCollection } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { emitFirestoreError } from "@/firebase/errors";
import { Page, PageHero, EmptyState, PageLoader } from "@/components/layout/page";
import { cn } from "@/lib/utils";


export default function RunnersPage() {
  const firestore = useFirestore();
  const participantsCollection = React.useMemo(() => collection(firestore, 'participants'), [firestore]);
  const { data: participants, loading: loadingParticipants } = useCollection<Participant>(participantsCollection as any);
  const { toast } = useToast();

  const [isParticipantDialogOpen, setIsParticipantDialogOpen] = React.useState(false);
  const [editingParticipant, setEditingParticipant] = React.useState<Participant | undefined>(undefined);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<{ single?: Participant, multiple?: string[] } | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [profileFilter, setProfileFilter] = React.useState('all');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAddOrUpdateParticipant = (participantData: Omit<Participant, 'id'> & { id?: string }) => {
    try {
      if (participantData.id && participants?.some((p) => p.id === participantData.id)) {
        const { id, ...dataToUpdate } = participantData;
        const participantDocRef = doc(firestore, 'participants', id);
        updateDoc(participantDocRef, { ...dataToUpdate, name: deleteField() })
          .catch(err => {
            emitFirestoreError(err, {
              operation: 'update',
              path: participantDocRef.path,
              requestResourceData: dataToUpdate
            });
          });
      } else {
        const { id, ...dataToAdd } = participantData;
        addDoc(participantsCollection, dataToAdd)
         .catch(err => {
            emitFirestoreError(err, {
              operation: 'create',
              path: participantsCollection.path,
              requestResourceData: dataToAdd
            });
          });
      }
      closeParticipantDialog();
    } catch (error) {
      console.error("Error saving participant: ", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'enregistrer le participant.",
      });
    }
  };
  
  const openDeleteDialog = (target: { single?: Participant, multiple?: string[] }) => {
    setDeleteTarget(target);
    setIsDeleteAlertOpen(true);
  };

  const confirmDeleteParticipant = async () => {
    if (!deleteTarget || isDeleting) return;

    const idsToDelete = [...new Set(deleteTarget.single ? [deleteTarget.single.id] : deleteTarget.multiple || [])];
    if (idsToDelete.length === 0) return;
  
    setIsDeleting(true);
    let deletionSucceeded = false;
    try {
      const selectedSet = new Set(idsToDelete);
      const regattasSnapshot = await getDocs(collection(firestore, 'regattas'));

      // Read each affected entry once so deleting two members of the same crew
      // cannot leave a stale crewIds array behind.
      const affectedEntries = new Map<string, { ref: (typeof regattasSnapshot.docs)[number]['ref']; crewIds: string[] }>();
      for (const regattaDoc of regattasSnapshot.docs) {
        const entriesRef = collection(regattaDoc.ref, 'participants');
        for (let start = 0; start < idsToDelete.length; start += 30) {
          const idChunk = idsToDelete.slice(start, start + 30);
          const entriesSnapshot = await getDocs(query(entriesRef, where('crewIds', 'array-contains-any', idChunk)));
          entriesSnapshot.docs.forEach(entryDoc => {
            const data = entryDoc.data();
            affectedEntries.set(entryDoc.ref.path, {
              ref: entryDoc.ref,
              crewIds: Array.isArray(data.crewIds) ? data.crewIds : [],
            });
          });
        }
      }

      const writeOps: Array<(batch: WriteBatch) => void> = [
        ...idsToDelete.map(id => (batch: WriteBatch) => batch.delete(doc(firestore, 'participants', id))),
        ...[...affectedEntries.values()].map(entry => {
          const crewIds = entry.crewIds.filter(id => !selectedSet.has(id));
          return (batch: WriteBatch) => crewIds.length === 0
            ? batch.delete(entry.ref)
            : batch.update(entry.ref, { crewIds });
        }),
      ];
      // Firestore limits a batch to 500 writes; leave headroom for future additions.
      for (let start = 0; start < writeOps.length; start += 400) {
        const batch = writeBatch(firestore);
        writeOps.slice(start, start + 400).forEach(write => write(batch));
        await batch.commit();
      }
      deletionSucceeded = true;
  
      toast({
        title: `${idsToDelete.length} coureur(s) supprimé(s)`,
        description: `Les coureurs ont été retirés de la base de données et de toutes les régates.`,
      });
  
    } catch (err) {
      console.error("Batch delete error:", err);
      toast({
        variant: "destructive",
        title: "Erreur de suppression",
        description: "Une erreur est survenue.",
      });
    } finally {
      setIsDeleting(false);
    }
    
    if (deletionSucceeded) {
      setIsDeleteAlertOpen(false);
      setDeleteTarget(null);
      setSelectedIds([]);
    }
  };

  const openParticipantDialog = (participant?: Participant) => {
    setEditingParticipant(participant);
    setIsParticipantDialogOpen(true);
  };

  const closeParticipantDialog = () => {
    setEditingParticipant(undefined);
    setIsParticipantDialogOpen(false);
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      Papa.parse<any>(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const requiredHeaders = ['club', 'category', 'sailType'];
          const optionalLicenseHeader = ['licenseNumber', 'licenceNumber'];
          const fileHeaders = results.meta.fields || [];

          const hasNameHeaders = fileHeaders.includes('name') || (fileHeaders.includes('firstName') && fileHeaders.includes('lastName'));
          const hasRequiredHeaders = requiredHeaders.every(h => fileHeaders.includes(h)) && hasNameHeaders;
          const hasLicenseHeader = optionalLicenseHeader.some(h => fileHeaders.includes(h));

          if (!hasRequiredHeaders || !hasLicenseHeader) {
             const missing = requiredHeaders.filter(header => !fileHeaders.includes(header));
             if (!hasNameHeaders) missing.push('name (or firstName + lastName)');
             if (!hasLicenseHeader) missing.push('licenseNumber (or licenceNumber)');
            toast({
              variant: "destructive",
              title: "Erreur d'import",
              description: `Colonnes manquantes ou mal nommées : ${missing.join(', ')}. Colonnes requises: name (ou firstName + lastName), club, licenseNumber (ou licenceNumber), category, sailType.`,
            });
            return;
          }

          try {
            const currentParticipantsSnapshot = await getDocs(participantsCollection);
            const existingLicenseNumbers = new Set(currentParticipantsSnapshot.docs
                .map(d => (d.data() as Participant).licenseNumber)
                .filter(Boolean) // Filter out null/undefined licenses
            );

            const participantsToProcess = results.data.map(row => {
                const nameParts = row.firstName && row.lastName
                  ? { firstName: row.firstName.trim(), lastName: row.lastName.trim() }
                  : splitFullName(row.name || '');
                const license = row.licenseNumber || row.licenceNumber || null;
                return {
                    ...nameParts,
                    club: row.club?.trim() || 'N/A',
                    licenseNumber: license ? license.trim() : `temp-${nameParts.firstName}-${nameParts.lastName}-${Date.now()}`,
                    category: ['Jeune', 'Confirmé', 'Vétéran', 'Catamaran', 'Dériveur'].includes(row.category) ? row.category : 'Confirmé',
                    sailType: ['Windsurf', 'Wingfoil', 'Catamaran', 'Dinghy'].includes(row.sailType) ? row.sailType : 'Windsurf',
                };
            }).filter(p => p.firstName.trim() !== '' && p.lastName.trim() !== '');

            const newParticipants = participantsToProcess.filter(p => !existingLicenseNumbers.has(p.licenseNumber));

            if (newParticipants.length > 0) {
              const batch = writeBatch(firestore);
              newParticipants.forEach(p => {
                const docRef = doc(collection(firestore, "participants"));
                batch.set(docRef, p);
              });
              await batch.commit();
              
              toast({
                title: "Importation réussie",
                description: `${newParticipants.length} nouveaux coureurs ont été importés et ajoutés. ${participantsToProcess.length - newParticipants.length} coureurs existants (basé sur la licence) ont été ignorés.`,
              });
            } else {
               toast({
                title: "Importation terminée",
                description: "Aucun nouveau coureur à ajouter (les licences existent peut-être déjà).",
              });
            }
          } catch(error) {
              toast({
              variant: "destructive",
              title: "Erreur d'importation",
              description: "Une erreur est survenue lors de l'ajout des coureurs.",
            });
            console.error(error);
          }
        },
        error: (error) => {
          toast({
            variant: "destructive",
            title: "Erreur de lecture du fichier",
            description: error.message,
          });
        },
      });
      if(fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  
  const handleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...new Set([...prev, ...sortedParticipants.map(p => p.id)])]);
    } else {
      const visibleIds = new Set(sortedParticipants.map(p => p.id));
      setSelectedIds(prev => prev.filter(id => !visibleIds.has(id)));
    }
  }

  const handleBulkProfileChange = async (profileType: NonNullable<Participant['profileType']>) => {
    if (selectedIds.length === 0) return;
    try {
      for (let start = 0; start < selectedIds.length; start += 400) {
        const batch = writeBatch(firestore);
        selectedIds.slice(start, start + 400).forEach(id => {
          batch.update(doc(firestore, 'participants', id), { profileType });
        });
        await batch.commit();
      }
      toast({ title: 'Profils mis à jour', description: `${selectedIds.length} fiche(s) modifiée(s).` });
      setSelectedIds([]);
    } catch (error) {
      console.error('Bulk profile update error:', error);
      toast({ variant: 'destructive', title: 'Mise à jour impossible', description: 'Les profils sélectionnés n’ont pas pu être modifiés.' });
    }
  };

  const profileLabel = (profileType?: Participant['profileType']) => ({
    annualMember: 'Membre à l’année',
    vacationRegular: 'Habitué vacances',
    visitor: 'Visiteur',
    unclassified: 'À classer',
  }[profileType ?? 'unclassified']);

  const profileCounts = React.useMemo(() => {
    const counts = { annualMember: 0, vacationRegular: 0, visitor: 0, unclassified: 0 };
    participants?.forEach(participant => { counts[participant.profileType ?? 'unclassified'] += 1; });
    return counts;
  }, [participants]);

  const sortedParticipants = React.useMemo(() => {
    const needle = searchTerm.trim().toLocaleLowerCase('fr-FR');
    return participants ? [...participants]
      .filter(participant => `${participantSearchText(participant)} ${participant.club} ${participant.licenseNumber} ${participant.sailType}`.toLocaleLowerCase('fr-FR').includes(needle))
      .filter(participant => profileFilter === 'all' || (participant.profileType ?? 'unclassified') === profileFilter)
      .sort((a, b) => (a.lastName ?? a.name ?? '').localeCompare(b.lastName ?? b.name ?? '', 'fr') || (a.firstName ?? '').localeCompare(b.firstName ?? '', 'fr')) : [];
  }, [participants, searchTerm, profileFilter]
  );
  
  const sailTone: Record<Participant['sailType'], string> = {
    Windsurf: 'bg-primary/12 text-primary',
    Wingfoil: 'bg-signal/12 text-signal',
    Catamaran: 'bg-teal-500/12 text-teal-700 dark:text-teal-300',
    Dinghy: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  };
  const initials = (participant: Participant) => participantDisplayName(participant).split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
  const allVisibleSelected = sortedParticipants.length > 0 && sortedParticipants.every(p => selectedIds.includes(p.id));
  const someVisibleSelected = sortedParticipants.some(p => selectedIds.includes(p.id));

  const renderContent = () => {
    if (loadingParticipants) return <PageLoader label="Chargement de l’annuaire…" />;
    if (sortedParticipants.length === 0) {
      return searchTerm || profileFilter !== 'all'
        ? <EmptyState icon={Search} title="Aucun résultat">Essayez un autre nom, un autre club ou retirez le filtre.</EmptyState>
        : <EmptyState icon={Users} title="L’annuaire est vide" action={<Button size="lg" onClick={() => openParticipantDialog()}><UserPlus />Ajouter un coureur</Button>}>Ajoutez un coureur ou importez votre liste CSV.</EmptyState>;
    }
    return (
      <ul className="divide-y overflow-hidden rounded-3xl border bg-card shadow-soft">
        {sortedParticipants.map(participant => {
          const selected = selectedIds.includes(participant.id);
          return (
            <li key={participant.id} className={cn("flex items-center gap-1 pr-2 transition-colors duration-150", selected && "bg-primary/[0.05]")}>
              <label className="flex h-16 w-12 shrink-0 cursor-pointer items-center justify-center sm:w-14">
                <Checkbox aria-label={`Sélectionner ${participantDisplayName(participant)}`} checked={selected} onCheckedChange={() => handleSelect(participant.id)} />
              </label>
              <button type="button" onClick={() => openParticipantDialog(participant)} className="flex min-h-[68px] min-w-0 flex-1 items-center gap-3 py-2.5 text-left transition-opacity duration-100 active:opacity-70">
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold", sailTone[participant.sailType] ?? 'bg-muted')}>{initials(participant)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{participantDisplayName(participant)}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{participant.club} · {participant.category}{participant.licenseNumber && !participant.licenseNumber.startsWith('temp-') ? ` · ${participant.licenseNumber}` : ''}</span>
                </span>
                <span className="hidden shrink-0 gap-1.5 sm:flex">
                  <Badge variant="secondary">{participant.sailType === 'Dinghy' ? 'Dériveur' : participant.sailType}</Badge>
                  <Badge variant={participant.profileType === 'annualMember' ? 'default' : participant.profileType === 'unclassified' || !participant.profileType ? 'outline' : 'secondary'}>{profileLabel(participant.profileType)}</Badge>
                </span>
              </button>
              <Button variant="ghost" size="icon" className="shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => openDeleteDialog({ single: participant })} aria-label={`Supprimer ${participantDisplayName(participant)}`}>
                <Trash2 />
              </Button>
            </li>
          );
        })}
      </ul>
    );
  }

  const deleteAlertDescription = React.useMemo(() => {
    if (!deleteTarget) return "";
    const getSingleDesc = (p?: Participant) => `« ${p ? participantDisplayName(p) : ''} » sera retiré de l’annuaire et de toutes les régates où il est inscrit. Cette action est irréversible.`;
    const getMultipleDesc = (ids?: string[]) => `Les ${ids?.length} coureurs sélectionnés seront retirés de l’annuaire et de toutes les régates où ils sont inscrits. Cette action est irréversible.`;

    if (deleteTarget.single) return getSingleDesc(deleteTarget.single);
    if (deleteTarget.multiple) return getMultipleDesc(deleteTarget.multiple);
    return "Cette action est irréversible et supprimera les coureurs sélectionnés.";
  }, [deleteTarget]);

  const profileFilters = [
    ['annualMember', 'Membres'],
    ['vacationRegular', 'Habitués'],
    ['visitor', 'Visiteurs'],
    ['unclassified', 'À classer'],
  ] as const;

  return (
    <>
      <Page>
        <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileImport} />
        <PageHero
          eyebrow="Régates · annuaire"
          title="Coureurs"
          description="Les concurrents de vos régates : une fiche par personne, réutilisée à chaque inscription."
          actions={<>
            <Button variant="signal" size="xl" className="flex-1 md:flex-none" onClick={() => openParticipantDialog()}><UserPlus className="!size-5" />Ajouter</Button>
            <Button size="xl" className="flex-1 border border-white/15 bg-white/10 text-white shadow-none hover:bg-white/15 md:flex-none" onClick={() => fileInputRef.current?.click()}><Upload className="!size-5" />Importer<span className="hidden sm:inline">&nbsp;CSV</span></Button>
          </>}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {profileFilters.map(([key, label]) => {
              const active = profileFilter === key;
              return (
                <button key={key} type="button" aria-pressed={active} onClick={() => setProfileFilter(active ? 'all' : key)} className={cn("press-feedback rounded-2xl px-4 py-3 text-left ring-1 ring-inset", active ? "bg-white text-ink ring-white" : "bg-white/[0.06] ring-white/10 hover:bg-white/10")}>
                  <span className="block font-display text-3xl font-extrabold leading-none tabular-nums">{profileCounts[key]}</span>
                  <span className={cn("mt-1.5 block text-xs font-medium", active ? "text-ink/70" : "text-white/60")}>{label}</span>
                </button>
              );
            })}
          </div>
        </PageHero>

        <div className="sticky top-0 z-20 -mx-4 space-y-2 bg-background/85 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur-xl md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" enterKeyHint="search" autoComplete="off" className="h-12 rounded-2xl pl-11 shadow-soft" placeholder="Nom, club, licence…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          {!loadingParticipants && sortedParticipants.length > 0 && (
            <div className="flex items-center justify-between gap-3 px-1 text-sm">
              <label className="flex min-h-10 cursor-pointer items-center gap-3 font-medium text-muted-foreground">
                <Checkbox
                  aria-label="Sélectionner tous les coureurs affichés"
                  checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                  onCheckedChange={checked => handleSelectAll(checked === true)}
                />
                {sortedParticipants.length} coureur{sortedParticipants.length > 1 ? 's' : ''}{profileFilter !== 'all' ? ` · ${profileLabel(profileFilter as Participant['profileType'])}` : ''}
              </label>
              {profileFilter !== 'all' && <Button variant="ghost" size="sm" onClick={() => setProfileFilter('all')}>Tous les profils</Button>}
            </div>
          )}
        </div>

        {renderContent()}
      </Page>

      {/* Actions de la sélection, posées au-dessus de la barre d'onglets. */}
      {selectedIds.length > 0 && (
        <div className="fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl animate-rise items-center gap-2 rounded-2xl bg-ink p-2 pl-4 text-ink-foreground shadow-lift md:bottom-6 md:left-[calc(248px+1.5rem)]">
          <span aria-live="polite" className="mr-auto text-sm font-semibold tabular-nums">{selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''}</span>
          <Select onValueChange={value => void handleBulkProfileChange(value as NonNullable<Participant['profileType']>)}>
            <SelectTrigger className="h-10 w-auto gap-2 border-white/15 bg-white/10 text-sm text-white focus:ring-white/20"><SelectValue placeholder="Profil" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="annualMember">Membre à l’année</SelectItem>
              <SelectItem value="vacationRegular">Habitué des vacances</SelectItem>
              <SelectItem value="visitor">Visiteur / autre club</SelectItem>
              <SelectItem value="unclassified">À classer</SelectItem>
            </SelectContent>
          </Select>
          <Button size="icon" variant="destructive" className="h-10 w-10" onClick={() => openDeleteDialog({ multiple: selectedIds })} aria-label={`Supprimer ${selectedIds.length} coureur(s)`}><Trash2 /></Button>
          <Button size="icon" variant="ghost" className="h-10 w-10 text-white hover:bg-white/10" onClick={() => setSelectedIds([])} aria-label="Tout désélectionner"><X /></Button>
        </div>
      )}

      <Dialog open={isParticipantDialogOpen} onOpenChange={setIsParticipantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingParticipant ? "Modifier la fiche" : "Nouveau coureur"}</DialogTitle>
          </DialogHeader>
          <ParticipantForm
            participant={editingParticipant}
            onSubmit={handleAddOrUpdateParticipant}
            onClose={closeParticipantDialog}
          />
        </DialogContent>
      </Dialog>

       <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer {deleteTarget?.multiple ? `${deleteTarget.multiple.length} coureurs` : 'ce coureur'} ?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteAlertDescription}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsDeleteAlertOpen(false)}>Annuler</AlertDialogCancel>
              <AlertDialogAction disabled={isDeleting} onClick={(event) => { event.preventDefault(); void confirmDeleteParticipant(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isDeleting ? <><Loader2 className="animate-spin" /> Suppression…</> : `Supprimer${deleteTarget?.multiple ? ` (${deleteTarget.multiple.length})` : ""}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
