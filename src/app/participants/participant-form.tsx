
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

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
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
        
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prénom</FormLabel>
              <FormControl>
                <Input className="h-12" placeholder="Prénom" autoComplete="given-name" {...field} />
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
                <Input className="h-12" placeholder="Nom de famille" autoComplete="family-name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="club"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Club</FormLabel>
              <FormControl>
                <Input className="h-12" placeholder="Nom du club" {...field} />
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
                <FormLabel>Numéro de licence</FormLabel>
                <FormControl>
                  <Input className="h-12" placeholder="Numéro de licence" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Jeune">Jeune</SelectItem>
                  <SelectItem value="Confirmé">Confirmé</SelectItem>
                  <SelectItem value="Vétéran">Vétéran</SelectItem>
                  <SelectItem value="Catamaran">Catamaran</SelectItem>
                  <SelectItem value="Dériveur">Dériveur</SelectItem>
                </SelectContent>
              </Select>
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
                  <SelectTrigger className="h-12">
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
         <FormField
          control={form.control}
          name="sailType"
          render={({ field }) => (
             <FormItem className="space-y-3">
              <Label>Support Principal</Label>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="grid grid-cols-2 gap-2"
                >
                  <FormItem>
                    <FormControl>
                      <RadioGroupItem value="Windsurf" id="windsurf" className="peer sr-only" />
                    </FormControl>
                    <Label
                      htmlFor="windsurf"
                      className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-4 font-medium hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/20 [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      Windsurf
                    </Label>
                  </FormItem>
                  <FormItem >
                     <FormControl>
                      <RadioGroupItem value="Wingfoil" id="wingfoil" className="peer sr-only" />
                    </FormControl>
                     <Label
                      htmlFor="wingfoil"
                      className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-4 font-medium hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/20 [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      Wingfoil
                    </Label>
                  </FormItem>
                   <FormItem >
                     <FormControl>
                      <RadioGroupItem value="Catamaran" id="catamaran" className="peer sr-only" />
                    </FormControl>
                     <Label
                      htmlFor="catamaran"
                      className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-4 font-medium hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/20 [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      Catamaran
                    </Label>
                  </FormItem>
                   <FormItem >
                     <FormControl>
                      <RadioGroupItem value="Dinghy" id="dinghy" className="peer sr-only" />
                    </FormControl>
                     <Label
                      htmlFor="dinghy"
                      className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-4 font-medium hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/20 [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      Dériveur
                    </Label>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col-reverse justify-end gap-2 pt-4 sm:flex-row">
          <Button className="h-12" type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button className="h-12" type="submit">Enregistrer le coureur</Button>
        </div>
      </form>
    </Form>
  );
}
