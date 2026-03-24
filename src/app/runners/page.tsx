
"use client";

import * as React from "react";
import Papa from "papaparse";
import { collection, addDoc, updateDoc, deleteDoc, doc, writeBatch, getDocs, query, where } from "firebase/firestore";
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
import type { Participant } from "@/lib/types";
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
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAddOrUpdateParticipant = (participantData: Omit<Participant, 'id'> & { id?: string }) => {
    try {
      if (participantData.id && participants?.some((p) => p.id === participantData.id)) {
        const { id, ...dataToUpdate } = participantData;
        const participantDocRef = doc(firestore, 'participants', id);
        updateDoc(participantDocRef, dataToUpdate)
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
    if (!deleteTarget) return;

    const idsToDelete = deleteTarget.single ? [deleteTarget.single.id] : deleteTarget.multiple || [];
    if (idsToDelete.length === 0) return;
  
    try {
      const batch = writeBatch(firestore);
  
      // Get all regattas to check for participant entries
      const regattasSnapshot = await getDocs(collection(firestore, 'regattas'));
  
      for (const id of idsToDelete) {
        if (!id) continue; // Safety check
        
        // Mark the main participant document for deletion
        const participantDocRef = doc(firestore, 'participants', id);
        batch.delete(participantDocRef);
  
        // For each regatta, find where this participant is registered
        for (const regattaDoc of regattasSnapshot.docs) {
          const regattaParticipantsRef = collection(regattaDoc.ref, 'participants');
          const q = query(regattaParticipantsRef, where('crewIds', 'array-contains', id));
          const regattaParticipantsSnapshot = await getDocs(q);
  
          regattaParticipantsSnapshot.forEach(rpDoc => {
            const rpData = rpDoc.data();
            // If the participant is the ONLY one in the crew, delete the whole entry
            if (rpData.crewIds.length === 1) {
              batch.delete(rpDoc.ref);
            } else {
              // Otherwise, just remove them from the crew
              const updatedCrewIds = rpData.crewIds.filter((crewId: string) => crewId !== id);
              batch.update(rpDoc.ref, { crewIds: updatedCrewIds });
            }
          });
        }
      }
      
      await batch.commit();
  
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
    }
    
    setIsDeleteAlertOpen(false);
    setDeleteTarget(null);
    setSelectedIds([]);
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
          const requiredHeaders = ['name', 'club', 'category', 'sailType'];
          const optionalLicenseHeader = ['licenseNumber', 'licenceNumber'];
          const fileHeaders = results.meta.fields || [];

          const hasRequiredHeaders = requiredHeaders.every(h => fileHeaders.includes(h));
          const hasLicenseHeader = optionalLicenseHeader.some(h => fileHeaders.includes(h));

          if (!hasRequiredHeaders || !hasLicenseHeader) {
             const missing = [...requiredHeaders, 'licenseNumber/licenceNumber'].filter(h => !fileHeaders.includes(h.split('/')[0]));
            toast({
              variant: "destructive",
              title: "Erreur d'import",
              description: `Colonnes manquantes ou mal nommées : ${missing.join(', ')}. Colonnes requises: name, club, licenseNumber (ou licenceNumber), category, sailType.`,
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
                const license = row.licenseNumber || row.licenceNumber || null;
                return {
                    name: row.name?.trim() || 'N/A',
                    club: row.club?.trim() || 'N/A',
                    licenseNumber: license ? license.trim() : `temp-${row.name?.trim()}-${Date.now()}`,
                    category: ['Jeune', 'Confirmé', 'Vétéran', 'Catamaran', 'Dériveur'].includes(row.category) ? row.category : 'Confirmé',
                    sailType: ['Windsurf', 'Wingfoil', 'Catamaran', 'Dinghy'].includes(row.sailType) ? row.sailType : 'Windsurf',
                };
            }).filter(p => p.name !== 'N/A' && p.name.trim() !== '');

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
    if (checked && participants) {
      setSelectedIds(participants.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  }

  const sortedParticipants = React.useMemo(() => 
    participants ? [...participants].sort((a, b) => a.name.localeCompare(b.name)) : [],
    [participants]
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
        <Card className="overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
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
                              aria-label={`Select ${participant.name}`}
                              checked={selectedIds.includes(participant.id)}
                              onCheckedChange={() => handleSelect(participant.id)}
                            />
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold">{participant.name}</p>
                          <p className="text-sm text-muted-foreground md:hidden">{participant.club}</p>
                        </TableCell>
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
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          Aucun coureur dans votre base de données.
                      </TableCell>
                    </TableRow>
                )}
                </TableBody>
              </Table>
            </CardContent>
        </Card>
    )
  }
  
  const deleteAlertDescription = React.useMemo(() => {
    if (!deleteTarget) return "";
    const getSingleDesc = (p?: Participant) => `Cette action est irréversible. Le coureur "${p?.name}" sera définitivement supprimé de la base de données et de toutes les régates où il est inscrit.`;
    const getMultipleDesc = (ids?: string[]) => `Cette action est irréversible. Les ${ids?.length} coureurs sélectionnés seront définitivement supprimés de la base de données et de toutes les régates où ils sont inscrits.`;

    if (deleteTarget.single) return getSingleDesc(deleteTarget.single);
    if (deleteTarget.multiple) return getMultipleDesc(deleteTarget.multiple);
    return "Cette action est irréversible et supprimera les coureurs sélectionnés.";
  }, [deleteTarget]);


  return (
    <>
      <main className="flex flex-1 flex-col p-4 md:p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <Users className="h-8 w-8 text-primary shrink-0" />
            <h1 className="text-2xl font-bold">Base de Données Coureurs</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".csv"
              onChange={handleFileImport}
            />
             {selectedIds.length > 0 ? (
                <Button variant="destructive" onClick={() => openDeleteDialog({ multiple: selectedIds })}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer ({selectedIds.length})
                </Button>
            ) : (
              <>
                 <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Importer CSV
                </Button>
                <Button onClick={() => openParticipantDialog()}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Ajouter un coureur
                </Button>
              </>
            )}
            
          </div>
        </div>

        <div className="space-y-6">
           {renderContent()}
        </div>
      </main>

      <Dialog open={isParticipantDialogOpen} onOpenChange={setIsParticipantDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
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
              <AlertDialogAction onClick={confirmDeleteParticipant} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
