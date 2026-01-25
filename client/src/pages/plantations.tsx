import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Factory } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CountryFlag } from "@/components/country-flag";
import { z } from "zod";
import type { Plantation, Country } from "@shared/schema";

const plantationFormSchema = z.object({
  name: z.string().min(1, "Обов'язкове поле"),
  countryId: z.string().min(1, "Обов'язкове поле"),
});

type PlantationFormValues = z.infer<typeof plantationFormSchema>;

export default function Plantations() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlantation, setEditingPlantation] = useState<Plantation | null>(null);

  const { data: plantations, isLoading } = useQuery<(Plantation & { country?: Country })[]>({
    queryKey: ["/api/plantations"],
  });

  const { data: countries } = useQuery<Country[]>({
    queryKey: ["/api/countries"],
  });

  const form = useForm<PlantationFormValues>({
    resolver: zodResolver(plantationFormSchema),
    defaultValues: { name: "", countryId: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PlantationFormValues) => {
      return apiRequest("POST", "/api/plantations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plantations"] });
      toast({ title: "Плантацію додано" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Помилка", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PlantationFormValues & { id: string }) => {
      return apiRequest("PATCH", `/api/plantations/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plantations"] });
      toast({ title: "Плантацію оновлено" });
      setIsDialogOpen(false);
      setEditingPlantation(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Помилка", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/plantations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plantations"] });
      toast({ title: "Плантацію видалено" });
    },
    onError: () => {
      toast({ title: "Помилка", variant: "destructive" });
    },
  });

  const handleEdit = (plantation: Plantation) => {
    setEditingPlantation(plantation);
    form.reset({ name: plantation.name, countryId: plantation.countryId });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: PlantationFormValues) => {
    if (editingPlantation) {
      updateMutation.mutate({ ...data, id: editingPlantation.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const getCountryById = (id: string) => countries?.find(c => c.id === id);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Плантації</h1>
          <p className="text-muted-foreground">Ферми та плантації квітів</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) { setEditingPlantation(null); form.reset(); }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-plantation">
              <Plus className="h-4 w-4 mr-2" />
              Додати плантацію
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPlantation ? "Редагувати" : "Нова плантація"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Назва</FormLabel>
                      <FormControl>
                        <Input placeholder="Naivasha Roses" {...field} data-testid="input-plantation-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="countryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Країна</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-plantation-country">
                            <SelectValue placeholder="Оберіть країну" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {countries?.map((country) => (
                            <SelectItem key={country.id} value={country.id}>
                              <span className="flex items-center gap-2">
                                <CountryFlag code={country.code} />
                                {country.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingPlantation(null); form.reset(); }}>
                    Скасувати
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-plantation">
                    {editingPlantation ? "Зберегти" : "Створити"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : plantations?.length === 0 ? (
            <div className="text-center py-12">
              <Factory className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">Немає плантацій</h3>
              <p className="text-muted-foreground text-sm">Додайте першу плантацію</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Назва</TableHead>
                    <TableHead>Країна</TableHead>
                    <TableHead className="text-right">Дії</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plantations?.map((plantation) => {
                    const country = getCountryById(plantation.countryId);
                    return (
                      <TableRow key={plantation.id} className="hover-elevate">
                        <TableCell className="font-medium">{plantation.name}</TableCell>
                        <TableCell>
                          {country && (
                            <span className="flex items-center gap-2">
                              <CountryFlag code={country.code} />
                              {country.name}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(plantation)} data-testid={`button-edit-plantation-${plantation.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(plantation.id)} data-testid={`button-delete-plantation-${plantation.id}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
