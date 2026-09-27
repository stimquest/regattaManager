
"use client";

import * as React from "react";
import Link from 'next/link';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { collection, addDoc, deleteDoc, doc, writeBatch, getDocs } from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CalendarIcon, Sailboat, Plus, Trash2, Loader2, RefreshCw, Search, Flag, Trophy } from "lucide-react";
import { useFirestore, useCollection } from "@/firebase";
import type { Regatta } from "@/lib/types";
import { sampleRegattas, sampleAllParticipants } from "@/lib/sample-data";
import { emitFirestoreError } from "@/firebase/errors";


const formSchema = z.object({
  name: z.string().min(2, { message: "Le nom doit comporter au moins 2 caractères." }),
  date: z.string().min(1, { message: "La date est requise." }),
  type: z.enum(['individual', 'team', 'mixed'], { required_error: "Le type de régate est requis." }),
});

export default function Home() {
  const firestore = useFirestore();
  
  const regattasCollection = React.useMemo(() => {
    return collection(firestore, 'regattas');
  }, [firestore]);
  
  const { data: regattas, loading: loadingRegattas } = useCollection<Regatta>(regattasCollection as any);

  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [regattaToDelete, setRegattaToDelete] = React.useState<Regatta | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      date: new Date().toISOString().split('T')[0],
      type: "individual",
    },
  });

  const handleAddRegatta = (values: z.infer<typeof formSchema>) => {
    if (!regattasCollection) return;
    const newRegattaData = {
      name: values.name,
      date: values.date,
      type: values.type,
      heats: [],
    };
    
    addDoc(regattasCollection, newRegattaData).catch(err => {
      emitFirestoreError(err, {
        operation: 'create',
        path: regattasCollection.path,
        requestResourceData: newRegattaData
      });
    });

    form.reset({ name: "", date: new Date().toISOString().split('T')[0], type: "individual" });
    setIsAddDialogOpen(false);
  };
  
  const confirmDeleteRegatta = async () => {
    if (!regattaToDelete) return;

    try {
        const batch = writeBatch(firestore);

        const regattaDocRef = doc(firestore, 'regattas', regattaToDelete.id);
        
        // Delete subcollections (participants)
        const participantsSnapshot = await getDocs(collection(regattaDocRef, "participants"));
        participantsSnapshot.forEach(doc => batch.delete(doc.ref));

        // Delete the main regatta doc
        batch.delete(regattaDocRef);
        
        await batch.commit();

    } catch(err) {
       // This is a complex operation, for now we log the error
       console.error("Error deleting regatta and subcollections", err);
       emitFirestoreError(err, {
          operation: 'delete',
          path: `regattas/${regattaToDelete.id} and subcollections`,
        });
    }

    setRegattaToDelete(null);
  }

  const handleResetData = async () => {
    try {
      const batch = writeBatch(firestore);
  
      // 1. Delete all existing regattas and their participant subcollections
      const existingRegattasSnapshot = await getDocs(collection(firestore, "regattas"));
      for (const regattaDoc of existingRegattasSnapshot.docs) {
        try {
          const participantsSnapshot = await getDocs(collection(regattaDoc.ref, "participants"));
          participantsSnapshot.forEach(doc => batch.delete(doc.ref));
        } catch (subcollectionError) {
          console.error(`Could not get participants for regatta ${regattaDoc.id}, skipping deletion of subcollection.`, subcollectionError);
        }
        batch.delete(regattaDoc.ref);
      }
      
      // 2. Delete all existing global participants
      const existingParticipantsSnapshot = await getDocs(collection(firestore, 'participants'));
      existingParticipantsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
  
      // 3. Add sample global participants
      sampleAllParticipants.forEach(participant => {
         const { id, ...participantData } = participant;
         const docRef = doc(firestore, "participants", id);
         batch.set(docRef, participantData);
      });
  
      // 4. Add sample regattas and their participant subcollections
      for (const regatta of sampleRegattas) {
        const { participants: regattaParticipants, ...regattaData } = regatta;
        const regattaDocRef = doc(collection(firestore, "regattas")); // Auto-generate ID
        batch.set(regattaDocRef, regattaData);
  
        if (regattaParticipants) {
          regattaParticipants.forEach(rp => {
              const { id, ...entryData } = rp;
              const regattaParticipantRef = doc(collection(regattaDocRef, "participants"), id);
              batch.set(regattaParticipantRef, entryData);
          });
        }
      }
      
      await batch.commit();
      setIsResetDialogOpen(false);
    } catch (error) {
      // Batch writes are complex for contextual errors, logging for now
      console.error("Error resetting data: ", error);
    }
  }

  const visibleRegattas = React.useMemo(() => {
    const filtered = (regattas ?? []).filter(regatta => regatta.name.toLocaleLowerCase('fr-FR').includes(searchTerm.trim().toLocaleLowerCase('fr-FR')));
    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  }, [regattas, searchTerm]);
  
  const renderContent = () => {
    if (loadingRegattas) {
      return (
        <div className="flex justify-center items-center mt-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    
    if (visibleRegattas.length > 0) {
      return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visibleRegattas.map((regatta) => (
        <Card key={regatta.id} className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Sailboat className="h-5 w-5" /></span>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{new Date(`${regatta.date}T12:00:00`) >= new Date(new Date().toDateString()) ? 'À venir' : 'Passée'}</span>
            </div>
            <CardTitle className="line-clamp-2 min-h-12 text-lg">{regatta.name}</CardTitle>
            <CardDescription className="flex items-center gap-2 pt-1">
              <CalendarIcon className="h-4 w-4 shrink-0" />
              {new Date(`${regatta.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Flag className="h-4 w-4" />{regatta.heats?.length ?? 0} manches</span>
              <span className="flex items-center gap-1.5"><Trophy className="h-4 w-4" />{regatta.type === 'individual' ? 'Individuelle' : regatta.type === 'team' ? 'Équipe' : 'Mixte'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild className="h-12 flex-1 rounded-xl"><Link href={`/regatta/${regatta.id}/race-management`}>Ouvrir la régate</Link></Button>
              <Button variant="outline" size="icon" className="h-12 w-12 shrink-0 rounded-xl text-destructive hover:text-destructive" onClick={() => setRegattaToDelete(regatta)} aria-label={`Supprimer ${regatta.name}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}</div>;
    }

    return (
      <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
        <span className="mx-auto mb-4 block w-fit rounded-full bg-primary/10 p-4 text-primary"><Sailboat className="h-8 w-8" /></span>
        <p className="text-lg font-semibold">{searchTerm ? 'Aucune régate ne correspond' : 'Aucune régate enregistrée'}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{searchTerm ? 'Essayez un autre nom ou effacez la recherche.' : 'Créez une régate pour inscrire les coureurs, reporter les arrivées et calculer le classement.'}</p>
        {!searchTerm && <Button className="mt-5 h-12 rounded-xl" onClick={() => setIsAddDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Créer une régate</Button>}
      </div>
    );
  }

  return (
    <>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 pb-28 md:p-8">
        <section className="flex flex-col gap-5 rounded-3xl bg-slate-950 p-6 text-white sm:flex-row sm:items-end sm:justify-between md:p-8">
          <div><p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">Voile · comité de course</p><h1 className="text-3xl font-bold tracking-tight md:text-4xl">Régates</h1><p className="mt-2 max-w-xl text-sm text-slate-300 md:text-base">Préparez les inscriptions, saisissez les arrivées et laissez l’app calculer le classement.</p></div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-12 flex-1 rounded-xl bg-white text-slate-900 hover:bg-slate-100 sm:flex-none">
                  <Plus className="mr-2 h-4 w-4" />
                  Créer une régate
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Nouvelle Régate</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleAddRegatta)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                           <FormLabel>Nom de la régate</FormLabel>
                          <FormControl>
                            <Input className="h-12" placeholder="Nom de la régate" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                           <FormLabel>Date</FormLabel>
                          <FormControl>
                            <Input className="h-12" type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type de régate</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-12">
                                <SelectValue placeholder="Sélectionner un type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="individual">Individuelle (Windsurf, Wingfoil...)</SelectItem>
                              <SelectItem value="team">En Équipe (Catamaran, Dériveur...)</SelectItem>
                              <SelectItem value="mixed">Mixte (Individuels et Équipes)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex flex-col-reverse justify-end gap-2 pt-4 sm:flex-row">
                      <Button className="h-12" type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                          Annuler
                        </Button>
                      <Button className="h-12" type="submit">Créer la régate</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-xl font-bold">Vos régates</h2><p className="text-sm text-muted-foreground">{regattas?.length ?? 0} au total · les plus récentes en premier</p></div>
          <div className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-12 rounded-xl pl-10" placeholder="Rechercher une régate" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        </div>
        <div className="space-y-4">{renderContent()}</div>
        <div className="flex justify-end"><Button variant="ghost" className="h-11 text-muted-foreground" onClick={() => setIsResetDialogOpen(true)}><RefreshCw className="mr-2 h-4 w-4" />Charger les données de démonstration</Button></div>
      </main>
      
      <AlertDialog open={!!regattaToDelete} onOpenChange={(open) => !open && setRegattaToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. La régate "{regattaToDelete?.name}" et toutes les données associées (participants, manches, résultats...) seront définitivement supprimées.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setRegattaToDelete(null)}>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteRegatta} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Réinitialiser les données ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action effacera toutes les régates et tous les coureurs actuels, et les remplacera par un jeu de données de démonstration.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetData}>
                Confirmer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
