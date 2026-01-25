import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Settings as SettingsIcon,
  DollarSign,
  Bell,
  Palette,
  Globe,
  Save,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Settings } from "@shared/schema";

const settingsFormSchema = z.object({
  usdToUahRate: z.string().min(1, "Обов'язкове поле"),
  minOrderAmount: z.string().min(1, "Обов'язкове поле"),
  wholesaleDiscount: z.string().min(1, "Обов'язкове поле"),
  loyaltyPointsRate: z.string().min(1, "Обов'язкове поле"),
  autoExchangeRate: z.boolean(),
  notificationsEnabled: z.boolean(),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export default function SettingsPage() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<Settings[]>({
    queryKey: ["/api/settings"],
  });

  const getSettingValue = (key: string, defaultValue: string = "") => {
    const setting = settings?.find(s => s.key === key);
    return setting?.value || defaultValue;
  };

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    values: {
      usdToUahRate: getSettingValue("usd_to_uah_rate", "41.50"),
      minOrderAmount: getSettingValue("min_order_amount", "5000"),
      wholesaleDiscount: getSettingValue("wholesale_discount", "5"),
      loyaltyPointsRate: getSettingValue("loyalty_points_rate", "1000"),
      autoExchangeRate: getSettingValue("auto_exchange_rate") === "true",
      notificationsEnabled: getSettingValue("notifications_enabled") === "true",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SettingsFormValues) => {
      return apiRequest("POST", "/api/settings/bulk", {
        settings: [
          { key: "usd_to_uah_rate", value: data.usdToUahRate },
          { key: "min_order_amount", value: data.minOrderAmount },
          { key: "wholesale_discount", value: data.wholesaleDiscount },
          { key: "loyalty_points_rate", value: data.loyaltyPointsRate },
          { key: "auto_exchange_rate", value: data.autoExchangeRate.toString() },
          { key: "notifications_enabled", value: data.notificationsEnabled.toString() },
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Налаштування збережено" });
    },
    onError: () => {
      toast({ title: "Помилка збереження", variant: "destructive" });
    },
  });

  const fetchExchangeRateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/settings/fetch-exchange-rate");
    },
    onSuccess: (data: { rate: string }) => {
      form.setValue("usdToUahRate", data.rate);
      toast({ title: "Курс оновлено" });
    },
    onError: () => {
      toast({ title: "Помилка оновлення курсу", variant: "destructive" });
    },
  });

  const onSubmit = (data: SettingsFormValues) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Налаштування</h1>
          <p className="text-muted-foreground">Конфігурація системи</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Налаштування</h1>
          <p className="text-muted-foreground">Конфігурація системи</p>
        </div>
        <Button 
          onClick={form.handleSubmit(onSubmit)}
          disabled={updateMutation.isPending}
          data-testid="button-save-settings"
        >
          <Save className="h-4 w-4 mr-2" />
          Зберегти
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Валюта та ціни
                </CardTitle>
                <CardDescription>
                  Налаштування курсу валют та цінової політики
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="usdToUahRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Курс USD/UAH</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="41.50"
                            data-testid="input-exchange-rate"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => fetchExchangeRateMutation.mutate()}
                          disabled={fetchExchangeRateMutation.isPending}
                          data-testid="button-refresh-rate"
                        >
                          <RefreshCw className={`h-4 w-4 ${fetchExchangeRateMutation.isPending ? "animate-spin" : ""}`} />
                        </Button>
                      </div>
                      <FormDescription>
                        Курс для конвертації цін передзамовлень
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="autoExchangeRate"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Автоматичний курс</FormLabel>
                        <FormDescription>
                          Оновлювати курс автоматично щодня
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-auto-rate"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Separator />

                <FormField
                  control={form.control}
                  name="minOrderAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Мінімальна сума замовлення (грн)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="5000"
                          data-testid="input-min-order"
                        />
                      </FormControl>
                      <FormDescription>
                        Мінімальна сума для оформлення заявки
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="wholesaleDiscount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Знижка для великого опту (%)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="5"
                          data-testid="input-wholesale-discount"
                        />
                      </FormControl>
                      <FormDescription>
                        Знижка для клієнтів категорії "Великий опт"
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Програма лояльності
                </CardTitle>
                <CardDescription>
                  Налаштування бонусної програми
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="loyaltyPointsRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Нарахування балів (грн = 1 бал)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="1000"
                          data-testid="input-loyalty-rate"
                        />
                      </FormControl>
                      <FormDescription>
                        Скільки гривень потрібно витратити для 1 балу
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <h4 className="font-medium">Правила бонусної програми</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 100 балів = подарунок</li>
                    <li>• 10 замовлень = -1000 грн на 11-те</li>
                    <li>• 1 бал = {getSettingValue("loyalty_points_rate", "1000")} грн покупок</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Повідомлення
                </CardTitle>
                <CardDescription>
                  Налаштування сповіщень
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="notificationsEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Push-сповіщення</FormLabel>
                        <FormDescription>
                          Надсилати повідомлення про нові замовлення
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-notifications"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <h4 className="font-medium">Типи сповіщень</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Нове замовлення</li>
                    <li>• Зміна статусу замовлення</li>
                    <li>• Новий клієнт</li>
                    <li>• Масові розсилки</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Інтерфейс
                </CardTitle>
                <CardDescription>
                  Персоналізація вигляду
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">Темна тема</Label>
                      <p className="text-sm text-muted-foreground">
                        Використовуйте перемикач у шапці
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                    <h4 className="font-medium">Підтримувані мови</h4>
                    <div className="flex gap-2 flex-wrap">
                      <span className="px-2 py-1 rounded bg-primary/10 text-sm">🇺🇦 Українська</span>
                      <span className="px-2 py-1 rounded bg-muted text-sm text-muted-foreground">🇬🇧 English</span>
                      <span className="px-2 py-1 rounded bg-muted text-sm text-muted-foreground">🇷🇺 Русский</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </Form>
    </div>
  );
}
