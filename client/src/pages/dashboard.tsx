import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  Flower2,
  Clock,
} from "lucide-react";
import type { DashboardStats, Order, TopProduct, TopCustomer } from "@shared/schema";

function StatCard({
  title,
  value,
  change,
  icon: Icon,
  trend,
  suffix = "",
}: {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  trend?: "up" | "down";
  suffix?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {value}{suffix}
        </div>
        {change !== undefined && (
          <p className={`text-xs flex items-center gap-1 mt-1 ${
            trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-muted-foreground"
          }`}>
            {trend === "up" ? (
              <TrendingUp className="h-3 w-3" />
            ) : trend === "down" ? (
              <TrendingDown className="h-3 w-3" />
            ) : null}
            {change > 0 ? "+" : ""}{change}% від вчора
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RecentOrderCard({ order }: { order: Order }) {
  const statusColors: Record<string, string> = {
    new: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    confirmed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    shipped: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    completed: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
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

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <ShoppingCart className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium text-sm">{order.orderNumber}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(order.createdAt || "").toLocaleDateString("uk-UA")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge className={statusColors[order.status] || ""}>
          {statusLabels[order.status] || order.status}
        </Badge>
        <span className="font-semibold text-sm">{Number(order.totalUah).toLocaleString()} грн</span>
      </div>
    </div>
  );
}

function TopProductItem({ product, index }: { product: TopProduct; index: number }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{product.name}</p>
        <p className="text-xs text-muted-foreground">{product.variety}</p>
      </div>
      <div className="text-right">
        <p className="font-semibold text-sm">{product.totalSold} шт</p>
        <p className="text-xs text-muted-foreground">{Number(product.revenue).toLocaleString()} грн</p>
      </div>
    </div>
  );
}

function TopCustomerItem({ customer, index }: { customer: TopCustomer; index: number }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{customer.name}</p>
        <p className="text-xs text-muted-foreground">{customer.shopName}</p>
      </div>
      <div className="text-right">
        <p className="font-semibold text-sm">{customer.totalOrders} зам.</p>
        <p className="text-xs text-muted-foreground">{Number(customer.totalSpent).toLocaleString()} грн</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: recentOrders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders/recent"],
  });

  const { data: topProducts, isLoading: productsLoading } = useQuery<TopProduct[]>({
    queryKey: ["/api/analytics/top-products"],
  });

  const { data: topCustomers, isLoading: customersLoading } = useQuery<TopCustomer[]>({
    queryKey: ["/api/analytics/top-customers"],
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Дашборд</h1>
          <p className="text-muted-foreground">Огляд вашого бізнесу</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Flower2 className="h-3 w-3" />
            FlowerB2B
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-3 w-20 mt-2" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <StatCard
              title="Всього замовлень"
              value={stats?.totalOrders || 0}
              change={stats?.ordersChange}
              trend={stats?.ordersChange && stats.ordersChange > 0 ? "up" : "down"}
              icon={ShoppingCart}
            />
            <StatCard
              title="Виручка"
              value={`${(stats?.totalRevenue || 0).toLocaleString()}`}
              suffix=" грн"
              change={stats?.revenueChange}
              trend={stats?.revenueChange && stats.revenueChange > 0 ? "up" : "down"}
              icon={DollarSign}
            />
            <StatCard
              title="Клієнтів"
              value={stats?.totalCustomers || 0}
              icon={Users}
            />
            <StatCard
              title="Товарів"
              value={stats?.totalProducts || 0}
              icon={Package}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg">Останні замовлення</CardTitle>
            <a 
              href="/orders" 
              className="text-sm text-primary flex items-center gap-1 hover:underline"
              data-testid="link-all-orders"
            >
              Всі замовлення
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20 mt-1" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : recentOrders?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Ще немає замовлень</p>
              </div>
            ) : (
              <div>
                {recentOrders?.map((order) => (
                  <RecentOrderCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">Топ товари</CardTitle>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16 mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : topProducts?.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Ще немає даних
                </div>
              ) : (
                <div>
                  {topProducts?.slice(0, 5).map((product, i) => (
                    <TopProductItem key={product.id} product={product} index={i} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">Топ клієнти</CardTitle>
            </CardHeader>
            <CardContent>
              {customersLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16 mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : topCustomers?.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Ще немає даних
                </div>
              ) : (
                <div>
                  {topCustomers?.slice(0, 5).map((customer, i) => (
                    <TopCustomerItem key={customer.id} customer={customer} index={i} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
