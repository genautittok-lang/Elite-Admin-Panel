import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CountryFlag } from "@/components/country-flag";
import { z } from "zod";
import type { Country } from "@shared/schema";

const countryFormSchema = z.object({
  code: z.string().min(2, "Код має бути 2 символи").max(2),
  name: z.string().min(1, "Обов'язкове поле"),
});

type CountryFormValues = z.infer<typeof countryFormSchema>;

export default function Countries() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);

  const { data: countries, isLoading } = useQuery<Country[]>({
    queryKey: ["/api/countries"],
  });

  const form = useForm<CountryFormValues>({
    resolver: zodResolver(countryFormSchema),
    defaultValues: { code: "", name: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CountryFormValues) => {
      return apiRequest("POST", "/api/countries", { ...data, flag: data.code });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/countries"] });
      toast({ title: "Країну додано" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Помилка", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CountryFormValues & { id: string }) => {
      return apiRequest("PATCH", `/api/countries/${data.id}`, { ...data, flag: data.code });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/countries"] });
      toast({ title: "Країну оновлено" });
      setIsDialogOpen(false);
      setEditingCountry(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Помилка", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/countries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/countries"] });
      toast({ title: "Країну видалено" });
    },
    onError: () => {
      toast({ title: "Помилка", variant: "destructive" });
    },
  });

  const handleEdit = (country: Country) => {
    setEditingCountry(country);
    form.reset({ code: country.code, name: country.name });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: CountryFormValues) => {
    if (editingCountry) {
      updateMutation.mutate({ ...data, id: editingCountry.id });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Країни</h1>
          <p className="text-muted-foreground">Країни-постачальники квітів</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) { setEditingCountry(null); form.reset(); }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-country">
              <Plus className="h-4 w-4 mr-2" />
              Додати країну
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCountry ? "Редагувати" : "Нова країна"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Код (ISO)</FormLabel>
                      <FormControl>
                        <Input placeholder="KE" maxLength={2} {...field} data-testid="input-country-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Назва</FormLabel>
                      <FormControl>
                        <Input placeholder="Kenya" {...field} data-testid="input-country-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingCountry(null); form.reset(); }}>
                    Скасувати
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-country">
                    {editingCountry ? "Зберегти" : "Створити"}
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
          ) : countries?.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">Немає країн</h3>
              <p className="text-muted-foreground text-sm">Додайте першу країну</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Прапор</TableHead>
                    <TableHead>Код</TableHead>
                    <TableHead>Назва</TableHead>
                    <TableHead className="text-right">Дії</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {countries?.map((country) => (
                    <TableRow key={country.id} className="hover-elevate">
                      <TableCell><CountryFlag code={country.code} /></TableCell>
                      <TableCell className="font-mono">{country.code}</TableCell>
                      <TableCell className="font-medium">{country.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(country)} data-testid={`button-edit-country-${country.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(country.id)} data-testid={`button-delete-country-${country.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
