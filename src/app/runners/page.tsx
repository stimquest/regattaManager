
"use client";

import * as React from "react";
import Papa from "papaparse";
import { collection, addDoc, updateDoc, doc, writeBatch, getDocs, query, where, deleteField, type WriteBatch } from "firebase/firestore";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  FileEdit,
  Trash2,
  UserPlus,
  Loader2,
  Upload,
  Search,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  
  const renderContent = () => {
     if (loadingParticipants) {
      return (
        <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    
    return (
        <Card className="overflow-hidden rounded-2xl">
            <CardContent className="p-0">
              <div className="divide-y md:hidden">
                {sortedParticipants.length ? sortedParticipants.map(participant => <article key={participant.id} className="flex items-start gap-3 p-4">
                  <Checkbox className="mt-1" aria-label={`Sélectionner ${participantDisplayName(participant)}`} checked={selectedIds.includes(participant.id)} onCheckedChange={() => handleSelect(participant.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{participantDisplayName(participant)}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{participant.club}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{profileLabel(participant.profileType)}</span><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{participant.sailType}</span><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{participant.category}</span></div>
                    {participant.licenseNumber && !participant.licenseNumber.startsWith('temp-') && <p className="mt-2 text-xs text-muted-foreground">Licence {participant.licenseNumber}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1"><Button variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={() => openParticipantDialog(participant)} aria-label={`Modifier ${participantDisplayName(participant)}`}><FileEdit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl" onClick={() => openDeleteDialog({ single: participant })} aria-label={`Supprimer ${participantDisplayName(participant)}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                </article>) : <div className="p-10 text-center"><p className="font-medium">{searchTerm ? 'Aucun résultat' : 'Aucun coureur enregistré'}</p><p className="mt-1 text-sm text-muted-foreground">{searchTerm ? 'Essayez avec un autre nom ou un autre club.' : 'Ajoutez un coureur ou importez votre liste CSV.'}</p></div>}
              </div>
              <div className="hidden overflow-x-auto md:block">
               <Table>
                 <TableHeader>
                    <TableRow>
                      <TableHead className="p-4">
                        <Checkbox
                          aria-label="Select all"
                          checked={Boolean(participants && selectedIds.length === participants.length && participants.length > 0)}
                          onCheckedChange={(checked) => handleSelectAll(!!checked)}
                          data-state={participants && selectedIds.length > 0 && selectedIds.length < participants.length ? 'indeterminate' : (participants && selectedIds.length === participants.length && participants.length > 0 ? 'checked' : 'unchecked')}
                        />
                      </TableHead>
                      <TableHead>Coureur</TableHead>
                      <TableHead>Profil</TableHead>
                      <TableHead className="hidden md:table-cell">Support</TableHead>
                      <TableHead className="hidden md:table-cell">Catégorie</TableHead>
                      <TableHead className="hidden lg:table-cell">Licence</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                {sortedParticipants.length > 0 ? (
                    sortedParticipants.map((participant) => (
                    <TableRow key={participant.id} data-state={selectedIds.includes(participant.id) && "selected"}>
                        <TableCell className="p-4">
                          <Checkbox
                              aria-label={`Select ${participantDisplayName(participant)}`}
                              checked={selectedIds.includes(participant.id)}
                              onCheckedChange={() => handleSelect(participant.id)}
                            />
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold">{participantDisplayName(participant)}</p>
                          <p className="text-sm text-muted-foreground md:hidden">{participant.club}</p>
                        </TableCell>
                        <TableCell><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{profileLabel(participant.profileType)}</span></TableCell>
                        <TableCell className="hidden md:table-cell">{participant.sailType}</TableCell>
                        <TableCell className="hidden md:table-cell">{participant.category}</TableCell>
                        <TableCell className="hidden lg:table-cell">{participant.licenseNumber.startsWith('temp-') ? 'N/A' : participant.licenseNumber}</TableCell>
                        <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openParticipantDialog(participant)}>
                            <FileEdit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog({ single: participant })}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          {searchTerm ? 'Aucun résultat pour cette recherche.' : 'Aucun coureur dans votre base de données.'}
                      </TableCell>
                    </TableRow>
                )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
        </Card>
    )
  }
  
  const deleteAlertDescription = React.useMemo(() => {
    if (!deleteTarget) return "";
    const getSingleDesc = (p?: Participant) => `Cette action est irréversible. Le coureur "${p ? participantDisplayName(p) : ''}" sera définitivement supprimé de la base de données et de toutes les régates où il est inscrit.`;
    const getMultipleDesc = (ids?: string[]) => `Cette action est irréversible. Les ${ids?.length} coureurs sélectionnés seront définitivement supprimés de la base de données et de toutes les régates où ils sont inscrits.`;

    if (deleteTarget.single) return getSingleDesc(deleteTarget.single);
    if (deleteTarget.multiple) return getMultipleDesc(deleteTarget.multiple);
    return "Cette action est irréversible et supprimera les coureurs sélectionnés.";
  }, [deleteTarget]);


  return (
    <>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 pb-28 md:p-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">Annuaire du club</p><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold tracking-tight">Coureurs</h1><span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold tabular-nums">{participants?.length ?? '—'}</span></div><p className="mt-1 text-sm text-muted-foreground">Gérez les profils et retrouvez-les facilement lors des inscriptions.</p></div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".csv"
              onChange={handleFileImport}
            />
             {selectedIds.length > 0 ? (
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <Select onValueChange={value => void handleBulkProfileChange(value as NonNullable<Participant['profileType']>)}>
                    <SelectTrigger className="h-12 min-w-52 flex-1 sm:flex-none"><SelectValue placeholder="Modifier le profil" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annualMember">Membre à l’année</SelectItem>
                      <SelectItem value="vacationRegular">Habitué des vacances</SelectItem>
                      <SelectItem value="visitor">Visiteur / autre club</SelectItem>
                      <SelectItem value="unclassified">À classer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button className="h-12 flex-1 sm:flex-none" variant="destructive" onClick={() => openDeleteDialog({ multiple: selectedIds })}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer ({selectedIds.length})
                  </Button>
                </div>
            ) : (
              <>
                 <Button className="h-12 flex-1 sm:flex-none" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Importer CSV
                </Button>
                <Button className="h-12 flex-1 sm:flex-none" onClick={() => openParticipantDialog()}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Ajouter un coureur
                </Button>
              </>
            )}
            
          </div>
        </header>
        <div className="grid gap-3 sm:grid-cols-[minmax(15rem,24rem)_minmax(13rem,18rem)]">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-12 rounded-xl pl-10" placeholder="Rechercher par nom, club, licence…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
          <Select value={profileFilter} onValueChange={setProfileFilter}>
            <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Tous les profils" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les profils</SelectItem>
              <SelectItem value="annualMember">Membres à l’année</SelectItem>
              <SelectItem value="vacationRegular">Habitués des vacances</SelectItem>
              <SelectItem value="visitor">Visiteurs / autres clubs</SelectItem>
              <SelectItem value="unclassified">À classer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            ['annualMember', 'Membres à l’année'],
            ['vacationRegular', 'Habitués vacances'],
            ['visitor', 'Visiteurs'],
            ['unclassified', 'À classer'],
          ] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setProfileFilter(profileFilter === key ? 'all' : key)} className={`rounded-xl border p-3 text-left transition-colors ${profileFilter === key ? 'border-primary bg-primary/5' : 'bg-card hover:bg-muted/50'}`}>
              <span className="block text-xl font-bold tabular-nums">{profileCounts[key]}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </button>
          ))}
        </div>

        {!loadingParticipants && sortedParticipants.length > 0 && (
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2">
            <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm font-medium">
              <Checkbox
                aria-label="Sélectionner tous les coureurs affichés"
                checked={sortedParticipants.every(p => selectedIds.includes(p.id)) ? true : sortedParticipants.some(p => selectedIds.includes(p.id)) ? "indeterminate" : false}
                onCheckedChange={checked => handleSelectAll(checked === true)}
              />
              Sélectionner les {sortedParticipants.length} coureurs affichés
            </label>
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-3 text-sm">
                <span aria-live="polite" className="text-muted-foreground">{selectedIds.length} sélectionné{selectedIds.length > 1 ? "s" : ""}</span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>Tout désélectionner</Button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-6">
           {renderContent()}
        </div>
      </main>

      <Dialog open={isParticipantDialogOpen} onOpenChange={setIsParticipantDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingParticipant ? "Modifier le Coureur" : "Nouveau Coureur"}
            </DialogTitle>
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
              <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteAlertDescription}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsDeleteAlertOpen(false)}>Annuler</AlertDialogCancel>
              <AlertDialogAction disabled={isDeleting} onClick={(event) => { event.preventDefault(); void confirmDeleteParticipant(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Suppression…</> : `Supprimer${deleteTarget?.multiple ? ` (${deleteTarget.multiple.length})` : ""}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
