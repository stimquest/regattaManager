
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { splitFullName, type Participant } from "@/lib/types";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  firstName: z.string().min(2, { message: "Le prénom doit comporter au moins 2 caractères." }),
  lastName: z.string().min(2, { message: "Le nom doit comporter au moins 2 caractères." }),
  club: z.string().min(2, { message: "Le nom du club doit comporter au moins 2 caractères." }),
  licenseNumber: z.string().min(3, { message: "La licence doit comporter au moins 3 caractères." }),
  category: z.enum(['Jeune', 'Confirmé', 'Vétéran', 'Catamaran', 'Dériveur']),
  sailType: z.enum(['Windsurf', 'Wingfoil', 'Catamaran', 'Dinghy']),
  profileType: z.enum(['annualMember', 'vacationRegular', 'visitor', 'unclassified']),
});

type ParticipantFormProps = {
  participant?: Participant;
  onSubmit: (data: Omit<Participant, 'id'> & { id?: string }) => void;
  onClose: () => void;
};

export function ParticipantForm({ participant, onSubmit, onClose }: ParticipantFormProps) {
  const legacyNameParts = splitFullName(participant?.name ?? '');
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: participant?.firstName ?? legacyNameParts.firstName,
      lastName: participant?.lastName ?? legacyNameParts.lastName,
      club: participant?.club ?? "",
      licenseNumber: participant?.licenseNumber ?? "",
      category: participant?.category ?? "Confirmé",
      sailType: participant?.sailType ?? "Windsurf",
      profileType: participant?.profileType ?? "unclassified",
    },
  });

  const handleFormSubmit = (values: z.infer<typeof formSchema>) => {
    onSubmit({
      id: participant?.id,
      ...values
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prénom</FormLabel>
                <FormControl>
                  <Input placeholder="Jeanne" autoComplete="given-name" autoCapitalize="words" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom</FormLabel>
                <FormControl>
                  <Input placeholder="Martin" autoComplete="family-name" autoCapitalize="words" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="club"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Club</FormLabel>
                <FormControl>
                  <Input placeholder="Nom du club" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="licenseNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Licence</FormLabel>
                <FormControl>
                  <Input placeholder="N° de licence" autoCapitalize="characters" autoCorrect="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="sailType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Support</FormLabel>
              <ChoiceGroup value={field.value} onChange={field.onChange} options={[['Windsurf', 'Windsurf'], ['Wingfoil', 'Wingfoil'], ['Catamaran', 'Catamaran'], ['Dinghy', 'Dériveur']]} columns={4} />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Catégorie</FormLabel>
              <ChoiceGroup value={field.value} onChange={field.onChange} options={[['Jeune', 'Jeune'], ['Confirmé', 'Confirmé'], ['Vétéran', 'Vétéran'], ['Catamaran', 'Catamaran'], ['Dériveur', 'Dériveur']]} columns={3} />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="profileType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Profil au club</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un profil" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="annualMember">Membre du club à l’année</SelectItem>
                  <SelectItem value="vacationRegular">Habitué des vacances</SelectItem>
                  <SelectItem value="visitor">Visiteur ou autre club</SelectItem>
                  <SelectItem value="unclassified">À classer</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button size="lg" type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button size="lg" type="submit">{participant ? 'Enregistrer' : 'Ajouter le coureur'}</Button>
        </div>
      </form>
    </Form>
  );
}

/** Choix exclusif en puces tactiles : plus rapide qu'une liste déroulante au pouce. */
function ChoiceGroup({ value, onChange, options, columns }: { value: string; onChange: (value: string) => void; options: [string, string][]; columns: 3 | 4 }) {
  return (
    <div role="radiogroup" className={cn("grid gap-2", columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
      {options.map(([optionValue, label]) => {
        const selected = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(optionValue)}
            className={cn(
              "press-feedback h-11 rounded-xl border-2 px-2 text-sm font-semibold",
              selected ? "border-primary bg-primary/[0.06] text-primary" : "border-border bg-card hover:border-foreground/20"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
