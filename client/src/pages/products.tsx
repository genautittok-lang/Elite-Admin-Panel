import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Package,
  Filter,
  Flower2,
  ImagePlus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import type { ProductWithDetails, Country, Plantation, FlowerType } from "@shared/schema";

const productFormSchema = z.object({
  name: z.string().min(1, "Обов'язкове поле"),
  variety: z.string().min(1, "Обов'язкове поле"),
  typeId: z.string().min(1, "Обов'язкове поле"),
  countryId: z.string().min(1, "Обов'язкове поле"),
  plantationId: z.string().optional(),
  flowerClass: z.string().min(1, "Обов'язкове поле"),
  height: z.string().min(1, "Обов'язкове поле"),
  color: z.string().min(1, "Обов'язкове поле"),
  priceUsd: z.string().optional(),
  priceUah: z.string().optional(),
  packSize: z.number().optional(),
  status: z.string().default("available"),
  catalogType: z.string().default("preorder"),
  isPromo: z.boolean().default(false),
  images: z.array(z.string()).default([]),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

export default function Products() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [catalogFilter, setCatalogFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithDetails | null>(null);

  const { data: products, isLoading } = useQuery<ProductWithDetails[]>({
    queryKey: ["/api/products"],
  });

  const { data: countries } = useQuery<Country[]>({
    queryKey: ["/api/countries"],
  });

  const { data: plantations } = useQuery<Plantation[]>({
    queryKey: ["/api/plantations"],
  });

  const { data: flowerTypes } = useQuery<FlowerType[]>({
    queryKey: ["/api/flower-types"],
  });

  const { data: settings } = useQuery<Array<{ key: string; value: string }>>({
    queryKey: ["/api/settings"],
  });

  const exchangeRate = parseFloat(
    settings?.find((s) => s.key === "usd_to_uah_rate")?.value || "41.5"
  );

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      variety: "",
      typeId: "",
      countryId: "",
      flowerClass: "Standard",
      height: "50",
      color: "",
      status: "available",
      catalogType: "preorder",
      packSize: 25,
      isPromo: false,
    },
  });

  // Auto-calculate UAH price when USD price changes (only for new products or when USD changes)
  const watchPriceUsd = form.watch("priceUsd");
  const watchCatalogType = form.watch("catalogType");
  const [lastUsdValue, setLastUsdValue] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    // Only auto-calculate for preorder items when USD price actually changes
    if (watchCatalogType === "preorder" && watchPriceUsd && watchPriceUsd !== lastUsdValue) {
      const usdPrice = parseFloat(watchPriceUsd);
      if (!isNaN(usdPrice) && usdPrice > 0) {
        const uahPrice = (usdPrice * exchangeRate).toFixed(2);
        form.setValue("priceUah", uahPrice);
        setLastUsdValue(watchPriceUsd);
      }
    }
  }, [watchPriceUsd, exchangeRate, watchCatalogType, form, lastUsdValue]);

  const createMutation = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      return apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Товар створено" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Помилка створення", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ProductFormValues & { id: string }) => {
      const { id, ...updateData } = data;
      return apiRequest("PATCH", `/api/products/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Товар оновлено" });
      setIsDialogOpen(false);
      setEditingProduct(null);
      form.reset();
    },
    onError: (error: Error) => {
      console.error("Update error:", error);
      toast({ 
        title: "Помилка оновлення", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Товар видалено" });
    },
    onError: () => {
      toast({ title: "Помилка видалення", variant: "destructive" });
    },
  });

  const handleEdit = (product: ProductWithDetails) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      variety: product.variety,
      typeId: product.typeId,
      countryId: product.countryId,
      plantationId: product.plantationId || undefined,
      flowerClass: product.flowerClass,
      height: String(product.height),
      color: product.color,
      priceUsd: product.priceUsd?.toString() || "",
      priceUah: product.priceUah?.toString() || "",
      packSize: product.packSize || 25,
      status: product.status,
      catalogType: product.catalogType,
      isPromo: product.isPromo || false,
      images: product.images || [],
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: ProductFormValues) => {
    if (editingProduct) {
      updateMutation.mutate({ ...data, id: editingProduct.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredProducts = products?.filter((product) => {
    const matchesSearch = 
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.variety.toLowerCase().includes(search.toLowerCase());
    const matchesCountry = countryFilter === "all" || product.countryId === countryFilter;
    const matchesCatalog = catalogFilter === "all" || product.catalogType === catalogFilter;
    return matchesSearch && matchesCountry && matchesCatalog;
  });

  const statusColors: Record<string, string> = {
    available: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    preorder: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    expected: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  };

  const statusLabels: Record<string, string> = {
    available: "В наявності",
    preorder: "Під замовлення",
    expected: "Очікується",
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Товари</h1>
          <p className="text-sm text-muted-foreground">Каталог квітів</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingProduct(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full sm:w-auto" data-testid="button-add-product">
              <Plus className="h-4 w-4 mr-2" />
              Додати
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-2">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Редагувати товар" : "Новий товар"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Назва</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Троянда" 
                            {...field} 
                            data-testid="input-product-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="variety"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Сорт</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Freedom" 
                            {...field} 
                            data-testid="input-product-variety"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="typeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Тип</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-product-type">
                              <SelectValue placeholder="Оберіть тип" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {flowerTypes?.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                            <SelectTrigger data-testid="select-product-country">
                              <SelectValue placeholder="Оберіть країну" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {countries?.map((country) => (
                              <SelectItem key={country.id} value={country.id}>
                                {country.flag} {country.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="flowerClass"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Клас</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-product-class">
                              <SelectValue placeholder="Оберіть клас" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Standard">Standard</SelectItem>
                            <SelectItem value="Premium">Premium</SelectItem>
                            <SelectItem value="Garden">Garden</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="height"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Висота (см, можна декілька через кому)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="40, 50, 60"
                            {...field}
                            data-testid="input-product-height"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Колір (можна вказати декілька через кому)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Червоний, Білий, Рожевий" 
                            {...field} 
                            data-testid="input-product-color"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {/* USD price field - for all catalog types */}
                  <FormField
                    control={form.control}
                    name="priceUsd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ціна (USD)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="0.00" 
                            {...field} 
                            data-testid="input-product-price-usd"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* UAH price - auto-calculated from USD */}
                  <FormItem>
                    <FormLabel>Ціна (UAH) - авто</FormLabel>
                    <div className="flex items-center h-9 px-3 rounded-md border bg-muted text-muted-foreground">
                      {(() => {
                        const usd = parseFloat(form.watch("priceUsd") || "0");
                        if (usd > 0) {
                          return `${(usd * exchangeRate).toFixed(2)} грн (курс: ${exchangeRate})`;
                        }
                        return "Введіть ціну в USD";
                      })()}
                    </div>
                  </FormItem>
                  <FormField
                    control={form.control}
                    name="packSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Упаковка (шт)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 25)}
                            data-testid="input-product-pack"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Статус</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-product-status">
                              <SelectValue placeholder="Оберіть статус" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="available">В наявності</SelectItem>
                            <SelectItem value="preorder">Під замовлення</SelectItem>
                            <SelectItem value="expected">Очікується</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="catalogType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Тип каталогу</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-product-catalog">
                              <SelectValue placeholder="Оберіть тип" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="preorder">Передзамовлення</SelectItem>
                            <SelectItem value="instock">В наявності</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <FormLabel>Зображення</FormLabel>
                  <div className="grid grid-cols-4 gap-2">
                    {form.watch("images")?.map((url, index) => (
                      <div key={index} className="relative aspect-square rounded-md overflow-hidden border group">
                        <img src={url} alt="Product" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            const current = form.getValues("images") || [];
                            form.setValue("images", current.filter((_, i) => i !== index));
                          }}
                          className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    ))}
                    <label
                      className="aspect-square rounded-md border border-dashed flex flex-col items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        data-testid="input-product-image-upload"
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (!files || files.length === 0) return;
                          
                          for (const file of Array.from(files)) {
                            const formData = new FormData();
                            formData.append('image', file);
                            
                            try {
                              const response = await fetch('/api/upload', {
                                method: 'POST',
                                body: formData,
                              });
                              
                              if (response.ok) {
                                const data = await response.json();
                                const current = form.getValues("images") || [];
                                form.setValue("images", [...current, data.url]);
                              } else {
                                toast({
                                  title: "Помилка",
                                  description: "Не вдалося завантажити зображення",
                                  variant: "destructive",
                                });
                              }
                            } catch (error) {
                              toast({
                                title: "Помилка",
                                description: "Не вдалося завантажити зображення",
                                variant: "destructive",
                              });
                            }
                          }
                          e.target.value = '';
                        }}
                      />
                      <ImagePlus className="h-6 w-6 mb-1" />
                      <span className="text-[10px]">Завантажити</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingProduct(null);
                      form.reset();
                    }}
                  >
                    Скасувати
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-product"
                  >
                    {editingProduct ? "Зберегти" : "Створити"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="space-y-3 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Пошук..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-products"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-28 md:w-36 shrink-0" data-testid="select-country-filter">
                <SelectValue placeholder="Країна" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі країни</SelectItem>
                {countries?.map((country) => (
                  <SelectItem key={country.id} value={country.id}>
                    {country.flag} {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={catalogFilter} onValueChange={setCatalogFilter}>
              <SelectTrigger className="w-32 md:w-40 shrink-0" data-testid="select-catalog-filter">
                <SelectValue placeholder="Каталог" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі типи</SelectItem>
                <SelectItem value="preorder">Передзамовлення</SelectItem>
                <SelectItem value="instock">В наявності</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          ) : filteredProducts?.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">Немає товарів</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {search || countryFilter !== "all" || catalogFilter !== "all"
                  ? "Спробуйте змінити фільтри"
                  : "Додайте перший товар"}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {filteredProducts?.map((product) => (
                  <div key={product.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded overflow-hidden bg-muted flex items-center justify-center border shrink-0">
                        {product.images && product.images[0] ? (
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Flower2 className="h-5 w-5 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.variety}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span>{product.country?.flag}</span>
                          <Badge variant="outline" className="text-xs">{product.flowerClass}</Badge>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold">
                          {product.priceUsd ? `$${Number(product.priceUsd).toFixed(2)}` : "—"}
                        </p>
                        <Badge className={`${statusColors[product.status]} text-xs mt-1`}>
                          {statusLabels[product.status]}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEdit(product)}>
                        <Edit className="h-4 w-4 mr-1" /> Редагувати
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(product.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Товар</TableHead>
                      <TableHead>Країна</TableHead>
                      <TableHead>Клас</TableHead>
                      <TableHead>Висота</TableHead>
                      <TableHead>Ціна</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead className="text-right">Дії</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts?.map((product) => (
                      <TableRow key={product.id} className="hover-elevate">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded overflow-hidden bg-muted flex items-center justify-center border shrink-0">
                              {product.images && product.images[0] ? (
                                <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <Flower2 className="h-5 w-5 text-muted-foreground/40" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium line-clamp-1">{product.name}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">{product.variety}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-lg mr-1">{product.country?.flag}</span>
                          {product.country?.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{product.flowerClass}</Badge>
                        </TableCell>
                        <TableCell>{product.height} см</TableCell>
                        <TableCell>
                          {product.priceUsd ? (
                            <span className="font-semibold">
                              ${Number(product.priceUsd).toFixed(2)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[product.status] || ""}>
                            {statusLabels[product.status] || product.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEdit(product)}
                              data-testid={`button-edit-product-${product.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteMutation.mutate(product.id)}
                              data-testid={`button-delete-product-${product.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
