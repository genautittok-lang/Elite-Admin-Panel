import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  Flower2,
  Globe,
  Factory,
  Tags,
  Bell,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import type { Order } from "@shared/schema";
import kvitkaLogo from "@/assets/kvitka-logo.jpg";

const mainMenuItems = [
  { title: "Дашборд", url: "/", icon: LayoutDashboard },
  { title: "Замовлення", url: "/orders", icon: ShoppingCart, showBadge: true },
  { title: "Клієнти", url: "/customers", icon: Users },
  { title: "Аналітика", url: "/analytics", icon: BarChart3 },
];

const catalogMenuItems = [
  { title: "Товари", url: "/products", icon: Package },
  { title: "Країни", url: "/countries", icon: Globe },
  { title: "Плантації", url: "/plantations", icon: Factory },
  { title: "Типи квітів", url: "/flower-types", icon: Flower2 },
];

const settingsMenuItems = [
  { title: "Налаштування", url: "/settings", icon: Settings },
  { title: "Повідомлення", url: "/notifications", icon: Bell },
  { title: "Промо та акції", url: "/promotions", icon: Tags },
];

export function AppSidebar() {
  const [location] = useLocation();
  
  // Fetch new orders count for badge
  const { data: orders } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  const newOrdersCount = orders?.filter(o => o.status === 'new').length || 0;

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-3">
          <img 
            src={kvitkaLogo} 
            alt="KVITKA opt" 
            className="w-10 h-10 rounded-lg object-cover"
          />
          <div>
            <h1 className="font-semibold text-lg">KVITKA opt</h1>
            <p className="text-xs text-muted-foreground">Адмін панель</p>
          </div>
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Головне</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.url.replace("/", "") || "dashboard"}`}
                  >
                    <Link href={item.url} className="flex items-center justify-between w-full">
                      <span className="flex items-center gap-2">
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </span>
                      {item.showBadge && newOrdersCount > 0 && (
                        <Badge variant="destructive" data-testid="badge-new-orders">
                          {newOrdersCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Каталог</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {catalogMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.url.replace("/", "")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Система</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.url.replace("/", "")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-muted-foreground text-center">
          KVITKA opt v1.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
