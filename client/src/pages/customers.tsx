import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search,
  Filter,
  Eye,
  Ban,
  CheckCircle,
  Users,
  ShoppingCart,
  DollarSign,
  MapPin,
  Phone,
  Star,
  Store,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Customer, Order } from "@shared/schema";

const customerTypeLabels: Record<string, string> = {
  flower_shop: "Квітковий магазин",
  wholesale: "Великий опт",
};

export default function Customers() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: customerOrders } = useQuery<Order[]>({
    queryKey: ["/api/customers", selectedCustomer?.id, "orders"],
    enabled: !!selectedCustomer,
  });

  const toggleBlockMutation = useMutation({
    mutationFn: async ({ id, blocked }: { id: string; blocked: boolean }) => {
      return apiRequest("PATCH", `/api/customers/${id}/block`, { isBlocked: blocked });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ 
        title: variables.blocked ? "Клієнта заблоковано" : "Клієнта розблоковано" 
      });
    },
    onError: () => {
      toast({ title: "Помилка", variant: "destructive" });
    },
  });

  const exportCustomers = async () => {
    try {
      const response = await fetch("/api/customers/export");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customers-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
    } catch {
      toast({ title: "Помилка експорту", variant: "destructive" });
    }
  };

  const filteredCustomers = customers?.filter((customer) => {
    const matchesSearch = 
      customer.name.toLowerCase().includes(search.toLowerCase()) ||
      customer.shopName?.toLowerCase().includes(search.toLowerCase()) ||
      customer.phone?.includes(search) ||
      customer.city?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || customer.customerType === typeFilter;
    const matchesBlocked = customer.isBlocked !== true;
    return matchesSearch && matchesType;
  });

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Клієнти</h1>
          <p className="text-muted-foreground">База оптових клієнтів</p>
        </div>
        <Button onClick={exportCustomers} variant="outline" data-testid="button-export-customers">
          <Download className="h-4 w-4 mr-2" />
          Експорт CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{customers?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Всього клієнтів</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Store className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {customers?.filter(c => c.customerType === "flower_shop").length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Квіткові магазини</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {customers?.filter(c => c.customerType === "wholesale").length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Великий опт</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {customers?.reduce((acc, c) => acc + Number(c.totalSpent || 0), 0).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Загальна виручка (без скасованих), грн</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center gap-4 pb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Пошук за ім'ям, магазином, телефоном..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-customers"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44" data-testid="select-type-filter">
                <SelectValue placeholder="Тип клієнта" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі типи</SelectItem>
                <SelectItem value="flower_shop">Квітковий магазин</SelectItem>
                <SelectItem value="wholesale">Великий опт</SelectItem>
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
          ) : filteredCustomers?.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">Немає клієнтів</h3>
              <p className="text-muted-foreground text-sm">
                {search || typeFilter !== "all"
                  ? "Спробуйте змінити фільтри"
                  : "Клієнти з'являться тут"}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Клієнт</TableHead>
                    <TableHead>Telegram</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Місто</TableHead>
                    <TableHead>Замовлень</TableHead>
                    <TableHead>Витрачено</TableHead>
                    <TableHead>Бали</TableHead>
                    <TableHead className="text-right">Дії</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers?.map((customer) => (
                    <TableRow 
                      key={customer.id} 
                      className={`hover-elevate ${customer.isBlocked ? "opacity-50" : ""}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getInitials(customer.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              {customer.name}
                              {customer.isBlocked && (
                                <Badge variant="destructive" className="text-xs">
                                  Заблоковано
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {customer.shopName || "—"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(customer as any).telegramUsername ? (
                          <a 
                            href={`https://t.me/${(customer as any).telegramUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground hover:underline"
                            data-testid={`link-telegram-${customer.id}`}
                          >
                            @{(customer as any).telegramUsername}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {customerTypeLabels[customer.customerType] || customer.customerType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {customer.city || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{customer.totalOrders || 0}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {Number(customer.totalSpent || 0).toLocaleString()} грн
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-amber-500" />
                          {customer.loyaltyPoints || 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setSelectedCustomer(customer)}
                            data-testid={`button-view-customer-${customer.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => toggleBlockMutation.mutate({ 
                              id: customer.id, 
                              blocked: !customer.isBlocked 
                            })}
                            data-testid={`button-toggle-block-${customer.id}`}
                          >
                            {customer.isBlocked ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <Ban className="h-4 w-4 text-destructive" />
                            )}
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

      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Профіль клієнта
            </DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {getInitials(selectedCustomer.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{selectedCustomer.name}</h3>
                  {selectedCustomer.shopName && (
                    <p className="text-muted-foreground">{selectedCustomer.shopName}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    <Badge variant="outline">
                      {customerTypeLabels[selectedCustomer.customerType]}
                    </Badge>
                    {selectedCustomer.isBlocked && (
                      <Badge variant="destructive">Заблоковано</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Телефон
                  </p>
                  <p className="font-medium">{selectedCustomer.phone || "—"}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Місто
                  </p>
                  <p className="font-medium">{selectedCustomer.city || "—"}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Замовлень</p>
                    <p className="text-2xl font-bold">{selectedCustomer.totalOrders || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Витрачено</p>
                    <p className="text-2xl font-bold">
                      {Number(selectedCustomer.totalSpent || 0).toLocaleString()} грн
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Бонусні бали</p>
                    <p className="text-2xl font-bold">{selectedCustomer.loyaltyPoints || 0}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Останні замовлення</h4>
                {customerOrders?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ще немає замовлень</p>
                ) : (
                  <div className="space-y-2">
                    {customerOrders?.slice(0, 5).map((order) => (
                      <div 
                        key={order.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div>
                          <p className="font-medium">{order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.createdAt || "").toLocaleDateString("uk-UA")}
                          </p>
                        </div>
                        <p className="font-semibold">
                          {Number(order.totalUah).toLocaleString()} грн
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
