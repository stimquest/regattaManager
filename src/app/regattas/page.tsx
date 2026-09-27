"use client";

import * as React from "react";
import Link from 'next/link';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { collection, addDoc, doc, writeBatch, getDocs } from "firebase/firestore";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, RefreshCw, Search, Flag, User, Users, Shuffle, ChevronRight } from "lucide-react";
import { useFirestore, useCollection } from "@/firebase";
import type { Regatta } from "@/lib/types";
import { sampleRegattas, sampleAllParticipants } from "@/lib/sample-data";
import { emitFirestoreError } from "@/firebase/errors";
import { Page, PageHero, HeroStat, SectionHeader, EmptyState, LiveDot, PageLoader } from "@/components/layout/page";
import { DateBlock } from "@/components/date-block";
import { Sailboat } from "@/components/icons";
import { cn } from "@/lib/utils";


const formSchema = z.object({
  name: z.string().min(2, { message: "Le nom doit comporter au moins 2 caractères." }),
  date: z.string().min(1, { message: "La date est requise." }),
  type: z.enum(['individual', 'team', 'mixed'], { required_error: "Le type de régate est requis." }),
});

const regattaTypes = [
  { value: 'individual', label: 'Individuelle', hint: 'Windsurf, wingfoil…', icon: User },
  { value: 'team', label: 'En équipe', hint: 'Catamaran, dériveur…', icon: Users },
  { value: 'mixed', label: 'Mixte', hint: 'Solos et équipages', icon: Shuffle },
] as const;

const typeLabel = (type: Regatta['type']) => regattaTypes.find(item => item.value === type)?.label ?? 'Individuelle';

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function RegattaCard({ regatta, onDelete }: { regatta: Regatta; onDelete: () => void }) {
  const live = regatta.heats?.some(heat => heat.status === 'In Progress');
  const finished = regatta.heats?.filter(heat => heat.status === 'Finished').length ?? 0;
  const past = regatta.date < todayIso();
  const isToday = regatta.date === todayIso();
  return (
    <article className="group relative flex items-stretch rounded-3xl border bg-card shadow-soft transition-[border-color,box-shadow] duration-150 ease-out hover:border-foreground/15 hover:shadow-lift">
      <Link href={`/regatta/${regatta.id}/race-management`} className="pressable flex min-w-0 flex-1 items-center gap-4 rounded-3xl p-4 sm:p-5">
        <DateBlock date={regatta.date} tone={past ? 'muted' : 'primary'} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            {live ? <Badge variant="signal"><LiveDot className="h-2 w-2 [&>span]:h-2 [&>span]:w-2" />En cours</Badge>
              : isToday ? <Badge variant="solid">Aujourd’hui</Badge>
              : past ? <Badge variant="secondary">Passée</Badge>
              : <Badge>À venir</Badge>}
            <Badge variant="outline">{typeLabel(regatta.type)}</Badge>
          </div>
          <h3 className="line-clamp-2 font-display text-lg font-bold leading-tight">{regatta.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Flag className="h-3.5 w-3.5" />
            {regatta.heats?.length ?? 0} manche{(regatta.heats?.length ?? 0) > 1 ? 's' : ''}
            {finished > 0 && <span>· {finished} validée{finished > 1 ? 's' : ''}</span>}
          </p>
        </div>
        <ChevronRight className="hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" />
      </Link>
      <div className="flex items-start p-2 pl-0">
        <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={onDelete} aria-label={`Supprimer ${regatta.name}`}>
          <Trash2 />
        </Button>
      </div>
    </article>
  );
}

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
      date: todayIso(),
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

    form.reset({ name: "", date: todayIso(), type: "individual" });
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

  const today = todayIso();
  const upcoming = visibleRegattas.filter(regatta => regatta.date >= today || regatta.heats?.some(heat => heat.status === 'In Progress')).reverse();
  const past = visibleRegattas.filter(regatta => !upcoming.includes(regatta));
  const upcomingCount = (regattas ?? []).filter(regatta => regatta.date >= today).length;

  const renderContent = () => {
    if (loadingRegattas) return <PageLoader label="Chargement des régates…" />;

    if (visibleRegattas.length === 0) {
      return searchTerm
        ? <EmptyState icon={Search} title="Aucune régate ne correspond">Essayez un autre nom ou effacez la recherche.</EmptyState>
        : <EmptyState icon={Sailboat} title="Aucune régate pour l’instant" action={<Button size="lg" onClick={() => setIsAddDialogOpen(true)}><Plus />Créer une régate</Button>}>
            Créez une régate pour inscrire les coureurs, reporter les arrivées et calculer le classement.
          </EmptyState>;
    }

    return (
      <div className="space-y-8">
        {upcoming.length > 0 && (
          <section className="space-y-3">
            <SectionHeader title="À venir" description={`${upcoming.length} régate${upcoming.length > 1 ? 's' : ''}`} />
            <div className="rise-stagger grid grid-cols-1 gap-3 lg:grid-cols-2">
              {upcoming.map(regatta => <RegattaCard key={regatta.id} regatta={regatta} onDelete={() => setRegattaToDelete(regatta)} />)}
            </div>
          </section>
        )}
        {past.length > 0 && (
          <section className="space-y-3">
            <SectionHeader title="Passées" description="Les plus récentes en premier" />
            <div className="rise-stagger grid grid-cols-1 gap-3 lg:grid-cols-2">
              {past.map(regatta => <RegattaCard key={regatta.id} regatta={regatta} onDelete={() => setRegattaToDelete(regatta)} />)}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <>
      <Page>
        <PageHero
          eyebrow="Comité de course"
          title="Régates"
          description="Préparez les inscriptions, reportez les arrivées, l’app calcule le classement."
          actions={<Button variant="signal" size="xl" className="w-full md:w-auto" onClick={() => setIsAddDialogOpen(true)}><Plus className="!size-5" />Nouvelle régate</Button>}
        >
          <div className="grid grid-cols-2 gap-2 sm:max-w-sm sm:gap-3">
            <HeroStat value={regattas?.length ?? '—'} label="Au total" />
            <HeroStat value={regattas ? upcomingCount : '—'} label="À venir" />
          </div>
        </PageHero>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" enterKeyHint="search" className="h-12 rounded-2xl pl-11 shadow-soft" placeholder="Rechercher une régate" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>

        {renderContent()}

        <div className="flex justify-center pt-4">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setIsResetDialogOpen(true)}><RefreshCw />Charger les données de démonstration</Button>
        </div>
      </Page>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle régate</DialogTitle>
            <DialogDescription>Le nom et la date suffisent. Les inscriptions viennent ensuite.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddRegatta)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de la régate</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex. Coupe d’automne" autoComplete="off" {...field} />
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
                    <FormLabel>Format</FormLabel>
                    <div role="radiogroup" className="grid grid-cols-3 gap-2">
                      {regattaTypes.map(option => {
                        const selected = field.value === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => field.onChange(option.value)}
                            className={cn(
                              "press-feedback flex min-h-[96px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center",
                              selected ? "border-primary bg-primary/[0.06] text-primary" : "border-border bg-card text-foreground hover:border-foreground/20"
                            )}
                          >
                            <option.icon className="h-5 w-5" />
                            <span className="text-sm font-bold leading-tight">{option.label}</span>
                            <span className={cn("text-[11px] leading-tight", selected ? "text-primary/80" : "text-muted-foreground")}>{option.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button size="lg" type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Annuler</Button>
                <Button size="lg" type="submit">Créer la régate</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!regattaToDelete} onOpenChange={(open) => !open && setRegattaToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer « {regattaToDelete?.name} » ?</AlertDialogTitle>
              <AlertDialogDescription>
                La régate, ses inscriptions, ses manches et ses résultats seront définitivement supprimés.
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
              <AlertDialogTitle>Charger la démonstration ?</AlertDialogTitle>
              <AlertDialogDescription>
                Toutes les régates et tous les coureurs actuels seront effacés et remplacés par un jeu de données d’exemple.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Tout remplacer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
