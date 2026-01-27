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
import { Plus, Edit, Trash2, Box, ImagePlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import type { ProductWithDetails } from "@shared/schema";

const packagingFormSchema = z.object({
  name: z.string().min(1, "Обов'язкове поле"),
  priceUah: z.string().min(1, "Обов'язкове поле"),
  images: z.array(z.string()).default([]),
});

type PackagingFormValues = z.infer<typeof packagingFormSchema>;

export default function Packaging() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPackaging, setEditingPackaging] = useState<ProductWithDetails | null>(null);

  const { data: allProducts, isLoading } = useQuery<ProductWithDetails[]>({
    queryKey: ["/api/products"],
  });

  const packagingProducts = allProducts?.filter(p => p.catalogType === 'packaging') || [];

  const form = useForm<PackagingFormValues>({
    resolver: zodResolver(packagingFormSchema),
    defaultValues: {
      name: "",
      priceUah: "",
      images: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PackagingFormValues) => {
      const productData = {
        name: data.name,
        variety: data.name,
        typeId: null,
        countryId: null,
        plantationId: null,
        flowerClass: "Standard",
        height: "0",
        color: "",
        priceUsd: null,
        priceUah: data.priceUah,
        packSize: 1,
        status: "available",
        catalogType: "packaging",
        isPromo: false,
        promoPercent: 0,
        promoEndDate: null,
        images: data.images,
      };
      return apiRequest("POST", "/api/products", productData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Упакування додано" });
    },
    onError: (error: any) => {
      toast({ title: "Помилка", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PackagingFormValues }) => {
      const productData = {
        name: data.name,
        variety: data.name,
        priceUah: data.priceUah,
        images: data.images,
      };
      return apiRequest("PATCH", `/api/products/${id}`, productData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setIsDialogOpen(false);
      setEditingPackaging(null);
      form.reset();
      toast({ title: "Упакування оновлено" });
    },
    onError: (error: any) => {
      toast({ title: "Помилка", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Упакування видалено" });
    },
    onError: (error: any) => {
      toast({ title: "Помилка", description: error.message, variant: "destructive" });
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('images', file));

    try {
      const response = await fetch('/api/upload-multiple', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.urls) {
        const currentImages = form.getValues('images') || [];
        form.setValue('images', [...currentImages, ...data.urls]);
      }
    } catch (error) {
      toast({ title: "Помилка завантаження", variant: "destructive" });
    }
  };

  const onSubmit = (data: PackagingFormValues) => {
    if (editingPackaging) {
      updateMutation.mutate({ id: editingPackaging.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (packaging: ProductWithDetails) => {
    setEditingPackaging(packaging);
    form.reset({
      name: packaging.name,
      priceUah: packaging.priceUah || "",
      images: packaging.images || [],
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingPackaging(null);
    form.reset({
      name: "",
      priceUah: "",
      images: [],
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Упакування</h1>
          <p className="text-muted-foreground">Управління упакуванням для квітів</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} data-testid="button-add-packaging">
              <Plus className="w-4 h-4 mr-2" />
              Додати упакування
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingPackaging ? "Редагувати упакування" : "Додати упакування"}
              </DialogTitle>
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
                        <Input 
                          placeholder="Коробка для букета" 
                          {...field} 
                          data-testid="input-packaging-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priceUah"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ціна за 1 шт (UAH)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="50.00" 
                          {...field} 
                          data-testid="input-packaging-price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel>Фото</FormLabel>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {form.watch("images")?.map((img, idx) => (
                      <div key={idx} className="relative w-16 h-16">
                        <img
                          src={img}
                          alt=""
                          className="w-full h-full object-cover rounded"
                        />
                        <button
                          type="button"
                          className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-4 h-4 text-xs"
                          onClick={() => {
                            const images = form.getValues("images") || [];
                            form.setValue("images", images.filter((_, i) => i !== idx));
                          }}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    <ImagePlus className="w-4 h-4" />
                    <span>Додати фото</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                </FormItem>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Скасувати
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-packaging"
                  >
                    {editingPackaging ? "Зберегти" : "Додати"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Box className="w-5 h-5" />
            Список упакування
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          ) : packagingProducts.length === 0 ? (
            <div className="text-center py-12">
              <Box className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">Немає упакування</h3>
              <p className="text-muted-foreground text-sm">Додайте перше упакування</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Фото</TableHead>
                  <TableHead>Назва</TableHead>
                  <TableHead>Ціна</TableHead>
                  <TableHead className="text-right">Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packagingProducts.map((pkg) => (
                  <TableRow key={pkg.id} data-testid={`row-packaging-${pkg.id}`}>
                    <TableCell>
                      {pkg.images && pkg.images.length > 0 ? (
                        <img
                          src={pkg.images[0]}
                          alt={pkg.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                          <Box className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{pkg.name}</TableCell>
                    <TableCell>{pkg.priceUah} грн</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(pkg)}
                          data-testid={`button-edit-packaging-${pkg.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(pkg.id)}
                          data-testid={`button-delete-packaging-${pkg.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
