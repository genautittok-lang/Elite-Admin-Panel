import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tags, Percent, Package, Flame, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@shared/schema";

export default function Promotions() {
  const { toast } = useToast();

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const togglePromoMutation = useMutation({
    mutationFn: async ({ id, isPromo }: { id: string; isPromo: boolean }) => {
      return apiRequest("PATCH", `/api/products/${id}`, { isPromo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Статус акції оновлено" });
    },
    onError: () => {
      toast({ title: "Помилка", variant: "destructive" });
    },
  });

  const promoProducts = products?.filter(p => p.isPromo) || [];
  const regularProducts = products?.filter(p => !p.isPromo) || [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Промо та акції</h1>
        <p className="text-muted-foreground">Управління акційними товарами</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Flame className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{promoProducts.length}</p>
                <p className="text-sm text-muted-foreground">Акційних товарів</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Star className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{products?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Всього товарів</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Percent className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {products?.length ? Math.round((promoProducts.length / products.length) * 100) : 0}%
                </p>
                <p className="text-sm text-muted-foreground">Частка акцій</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            Акційні товари
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : promoProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Flame className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Немає акційних товарів</p>
              <p className="text-sm">Увімкніть акцію для товарів нижче</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Товар</TableHead>
                    <TableHead>Ціна</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Акція</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promoProducts.map((product) => (
                    <TableRow key={product.id} className="hover-elevate">
                      <TableCell>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.variety}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {product.priceUah ? `${Number(product.priceUah).toLocaleString()} грн` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={true}
                          onCheckedChange={(checked) => 
                            togglePromoMutation.mutate({ id: product.id, isPromo: checked })
                          }
                          data-testid={`switch-promo-${product.id}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Всі товари
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : regularProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Всі товари в акції</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Товар</TableHead>
                    <TableHead>Ціна</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Акція</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regularProducts.map((product) => (
                    <TableRow key={product.id} className="hover-elevate">
                      <TableCell>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.variety}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {product.priceUah ? `${Number(product.priceUah).toLocaleString()} грн` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={false}
                          onCheckedChange={(checked) => 
                            togglePromoMutation.mutate({ id: product.id, isPromo: checked })
                          }
                          data-testid={`switch-promo-${product.id}`}
                        />
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
