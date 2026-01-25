import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Edit, Trash2, Flower2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import type { FlowerType } from "@shared/schema";

const flowerTypeFormSchema = z.object({
  name: z.string().min(1, "Обов'язкове поле"),
  category: z.string().min(1, "Обов'язкове поле"),
});

type FlowerTypeFormValues = z.infer<typeof flowerTypeFormSchema>;

export default function FlowerTypes() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<FlowerType | null>(null);

  const { data: flowerTypes, isLoading } = useQuery<FlowerType[]>({
    queryKey: ["/api/flower-types"],
  });

  const form = useForm<FlowerTypeFormValues>({
    resolver: zodResolver(flowerTypeFormSchema),
    defaultValues: { name: "", category: "single" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FlowerTypeFormValues) => {
      return apiRequest("POST", "/api/flower-types", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flower-types"] });
      toast({ title: "Тип додано" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Помилка", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FlowerTypeFormValues & { id: string }) => {
      return apiRequest("PATCH", `/api/flower-types/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flower-types"] });
      toast({ title: "Тип оновлено" });
      setIsDialogOpen(false);
      setEditingType(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Помилка", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/flower-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flower-types"] });
      toast({ title: "Тип видалено" });
    },
    onError: () => {
      toast({ title: "Помилка", variant: "destructive" });
    },
  });

  const handleEdit = (type: FlowerType) => {
    setEditingType(type);
    form.reset({ name: type.name, category: type.category });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: FlowerTypeFormValues) => {
    if (editingType) {
      updateMutation.mutate({ ...data, id: editingType.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const categoryLabels: Record<string, string> = {
    single: "Одиночні",
    spray: "Кущові",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Типи квітів</h1>
          <p className="text-muted-foreground">Категорії та типи квітів</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) { setEditingType(null); form.reset(); }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-flower-type">
              <Plus className="h-4 w-4 mr-2" />
              Додати тип
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingType ? "Редагувати" : "Новий тип"}</DialogTitle>
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
                        <Input placeholder="Троянда" {...field} data-testid="input-flower-type-name" />
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
                      <FormLabel>Категорія</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-flower-type-category">
                            <SelectValue placeholder="Оберіть категорію" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="single">Одиночні (single)</SelectItem>
                          <SelectItem value="spray">Кущові (spray)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingType(null); form.reset(); }}>
                    Скасувати
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-flower-type">
                    {editingType ? "Зберегти" : "Створити"}
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
          ) : flowerTypes?.length === 0 ? (
            <div className="text-center py-12">
              <Flower2 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">Немає типів</h3>
              <p className="text-muted-foreground text-sm">Додайте перший тип</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Назва</TableHead>
                    <TableHead>Категорія</TableHead>
                    <TableHead className="text-right">Дії</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flowerTypes?.map((type) => (
                    <TableRow key={type.id} className="hover-elevate">
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {categoryLabels[type.category] || type.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(type)} data-testid={`button-edit-flower-type-${type.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(type.id)} data-testid={`button-delete-flower-type-${type.id}`}>
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
