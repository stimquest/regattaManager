
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
import { CalendarIcon, Sailboat, Plus, Trash2, Loader2, RefreshCw } from "lucide-react";
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
  
  const renderContent = () => {
    if (loadingRegattas) {
      return (
        <div className="flex justify-center items-center mt-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    
    if (regattas && regattas.length > 0) {
      return regattas.map((regatta) => (
        <Card key={regatta.id}>
          <CardHeader>
            <CardTitle>{regatta.name}</CardTitle>
            <CardDescription className="flex items-center gap-2 pt-1">
              <CalendarIcon className="h-4 w-4"/>
              {new Date(regatta.date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <Link href={`/regatta/${regatta.id}/race-management`} passHref>
              <Button>Gérer la Régate</Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={() => setRegattaToDelete(regatta)}>
                <Trash2 className="h-5 w-5 text-destructive" />
            </Button>
          </CardContent>
        </Card>
      ));
    }

    return (
      <div className="text-center text-muted-foreground mt-16">
        <p>Aucune régate pour le moment.</p>
        <p>Cliquez sur "Créer une Régate" pour commencer ou "Réinitialiser" pour charger les données de démo.</p>
      </div>
    );
  }

  return (
    <>
      <main className="flex flex-1 flex-col p-4 md:p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <Sailboat className="h-8 w-8 text-primary shrink-0" />
            <h1 className="text-2xl font-bold">Gestionnaire de Régates</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
             <Button onClick={() => setIsResetDialogOpen(true)} variant="outline" size="icon" title="Réinitialiser les données">
                <RefreshCw className="h-4 w-4" />
              </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer une Régate
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
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
                            <Input placeholder="Nom de la régate" {...field} />
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
                            <Input type="date" {...field} />
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
                              <SelectTrigger>
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
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                          Annuler
                        </Button>
                      <Button type="submit">Enregistrer</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="space-y-4">
          {renderContent()}
        </div>
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
