
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
import type { Participant } from "@/lib/types";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  name: z.string().min(2, { message: "Le nom doit comporter au moins 2 caractères." }),
  club: z.string().min(2, { message: "Le nom du club doit comporter au moins 2 caractères." }),
  licenseNumber: z.string().min(3, { message: "La licence doit comporter au moins 3 caractères." }),
  category: z.enum(['Jeune', 'Confirmé', 'Vétéran', 'Catamaran', 'Dériveur']),
  sailType: z.enum(['Windsurf', 'Wingfoil', 'Catamaran', 'Dinghy']),
});

type ParticipantFormProps = {
  participant?: Participant;
  onSubmit: (data: Omit<Participant, 'id'> & { id?: string }) => void;
  onClose: () => void;
};

export function ParticipantForm({ participant, onSubmit, onClose }: ParticipantFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: participant || {
      name: "",
      club: "",
      licenseNumber: "",
      category: "Confirmé",
      sailType: "Windsurf",
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder="Nom et prénom du coureur" {...field} />
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
              <FormControl>
                <Input placeholder="Club" {...field} />
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
                <FormControl>
                  <Input placeholder="Numéro de Licence" {...field} />
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
                  <SelectTrigger>
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
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit">Enregistrer</Button>
        </div>
      </form>
    </Form>
  );
}
