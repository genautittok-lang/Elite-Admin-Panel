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
import {
  Search,
  Filter,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Package,
  User,
  MapPin,
  Phone,
  MessageSquare,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { OrderWithDetails, OrderStatus } from "@shared/schema";

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  confirmed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  shipped: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  completed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const statusLabels: Record<string, string> = {
  new: "Нове",
  confirmed: "Підтверджено",
  processing: "В роботі",
  shipped: "Відправлено",
  completed: "Завершено",
  cancelled: "Скасовано",
};

export default function Orders() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [page, setPage] = useState(1);

  const { data: allOrders, isLoading } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/orders"],
  });

  // Client-side filtering and pagination
  const filteredOrders = allOrders?.filter((order) => {
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesOrderNumber = order.orderNumber?.toLowerCase().includes(searchLower);
      const matchesCustomerName = order.customer?.name?.toLowerCase().includes(searchLower);
      const matchesShopName = order.customer?.shopName?.toLowerCase().includes(searchLower);
      if (!matchesOrderNumber && !matchesCustomerName && !matchesShopName) return false;
    }
    return true;
  }) || [];

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const orders = filteredOrders.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      return apiRequest("PATCH", `/api/orders/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Статус оновлено" });
    },
    onError: () => {
      toast({ title: "Помилка оновлення", variant: "destructive" });
    },
  });

  const exportOrders = async () => {
    try {
      const response = await fetch("/api/orders/export");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
    } catch {
      toast({ title: "Помилка експорту", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Замовлення</h1>
          <p className="text-muted-foreground">Керування замовленнями клієнтів</p>
        </div>
        <Button onClick={exportOrders} variant="outline" data-testid="button-export-orders">
          <Download className="h-4 w-4 mr-2" />
          Експорт CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center gap-4 pb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Пошук за номером або клієнтом..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
              data-testid="input-search-orders"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40" data-testid="select-status-filter">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі статуси</SelectItem>
                <SelectItem value="new">Нові</SelectItem>
                <SelectItem value="confirmed">Підтверджені</SelectItem>
                <SelectItem value="processing">В роботі</SelectItem>
                <SelectItem value="shipped">Відправлені</SelectItem>
                <SelectItem value="completed">Завершені</SelectItem>
                <SelectItem value="cancelled">Скасовані</SelectItem>
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
          ) : filteredOrders?.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">Немає замовлень</h3>
              <p className="text-muted-foreground text-sm">
                {search || statusFilter !== "all" 
                  ? "Спробуйте змінити фільтри" 
                  : "Замовлення з'являться тут"}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Номер</TableHead>
                      <TableHead>Клієнт</TableHead>
                      <TableHead>Сума</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Дата</TableHead>
                      <TableHead className="text-right">Дії</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders?.map((order) => (
                      <TableRow key={order.id} className="hover-elevate">
                        <TableCell className="font-medium">
                          {order.orderNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.customer?.name || "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.customer?.shopName || "—"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {Number(order.totalUah).toLocaleString()} грн
                        </TableCell>
                        <TableCell>
                          <Select
                            value={order.status}
                            onValueChange={(status) => 
                              updateStatusMutation.mutate({ 
                                id: order.id, 
                                status: status as OrderStatus 
                              })
                            }
                          >
                            <SelectTrigger 
                              className="w-32 h-8"
                              data-testid={`select-order-status-${order.id}`}
                            >
                              <Badge className={`${statusColors[order.status]} text-xs`}>
                                {statusLabels[order.status]}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">Нове</SelectItem>
                              <SelectItem value="confirmed">Підтверджено</SelectItem>
                              <SelectItem value="processing">В роботі</SelectItem>
                              <SelectItem value="shipped">Відправлено</SelectItem>
                              <SelectItem value="completed">Завершено</SelectItem>
                              <SelectItem value="cancelled">Скасовано</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(order.createdAt || "").toLocaleDateString("uk-UA")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setSelectedOrder(order)}
                            data-testid={`button-view-order-${order.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Показано {orders?.length} з {filteredOrders?.length} замовлень
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm px-2">{page} / {totalPages || 1}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Замовлення {selectedOrder?.orderNumber}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Клієнт
                  </h4>
                  <div className="text-sm space-y-1">
                    <p>{selectedOrder.customer?.name}</p>
                    <p className="text-muted-foreground">{selectedOrder.customer?.shopName}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Контакти
                  </h4>
                  <div className="text-sm space-y-1">
                    <p>{selectedOrder.customer?.phone || "—"}</p>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {selectedOrder.customer?.city || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {selectedOrder.comment && (
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Коментар
                  </h4>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    {selectedOrder.comment}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Товари
                </h4>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Товар</TableHead>
                        <TableHead className="text-right">К-сть</TableHead>
                        <TableHead className="text-right">Ціна</TableHead>
                        <TableHead className="text-right">Сума</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="font-medium">{item.product?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.product?.variety}
                            </p>
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            {Number(item.priceUah).toLocaleString()} грн
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {Number(item.totalUah).toLocaleString()} грн
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <div>
                  <Badge className={statusColors[selectedOrder.status]}>
                    {statusLabels[selectedOrder.status]}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Загальна сума</p>
                  <p className="text-2xl font-bold">
                    {Number(selectedOrder.totalUah).toLocaleString()} грн
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
