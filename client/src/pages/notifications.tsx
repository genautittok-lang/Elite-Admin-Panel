import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Send, Users, Store, MessageSquare, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const notificationFormSchema = z.object({
  message: z.string().min(1, "Повідомлення обов'язкове"),
  targetGroup: z.string().min(1, "Оберіть групу"),
  language: z.string().default("ua"),
});

type NotificationFormValues = z.infer<typeof notificationFormSchema>;

export default function Notifications() {
  const { toast } = useToast();
  const [sentCount, setSentCount] = useState(0);

  const form = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationFormSchema),
    defaultValues: { message: "", targetGroup: "all", language: "ua" },
  });

  const sendMutation = useMutation({
    mutationFn: async (data: NotificationFormValues) => {
      return apiRequest("POST", "/api/notifications/send", data);
    },
    onSuccess: (data: { sent: number }) => {
      toast({ title: `Повідомлення надіслано (${data.sent} клієнтам)` });
      setSentCount(data.sent);
      form.reset();
    },
    onError: () => {
      toast({ title: "Помилка надсилання", variant: "destructive" });
    },
  });

  const onSubmit = (data: NotificationFormValues) => {
    sendMutation.mutate(data);
  };

  const targetGroupLabels: Record<string, { label: string; icon: React.ElementType }> = {
    all: { label: "Всі клієнти", icon: Users },
    flower_shop: { label: "Квіткові магазини", icon: Store },
    wholesale: { label: "Великий опт", icon: Megaphone },
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Повідомлення</h1>
        <p className="text-muted-foreground">Масові розсилки клієнтам</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Нове повідомлення
            </CardTitle>
            <CardDescription>
              Надішліть push-сповіщення вашим клієнтам
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="targetGroup"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Група отримувачів</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-target-group">
                            <SelectValue placeholder="Оберіть групу" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">
                            <span className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Всі клієнти
                            </span>
                          </SelectItem>
                          <SelectItem value="flower_shop">
                            <span className="flex items-center gap-2">
                              <Store className="h-4 w-4" />
                              Квіткові магазини
                            </span>
                          </SelectItem>
                          <SelectItem value="wholesale">
                            <span className="flex items-center gap-2">
                              <Megaphone className="h-4 w-4" />
                              Великий опт
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Мова повідомлення</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-language">
                            <SelectValue placeholder="Оберіть мову" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ua">UA - Українська</SelectItem>
                          <SelectItem value="en">EN - English</SelectItem>
                          <SelectItem value="ru">RU - Русский</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Клієнти отримають повідомлення своєю мовою
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Текст повідомлення</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Введіть текст повідомлення..."
                          className="min-h-32 resize-none"
                          {...field}
                          data-testid="input-notification-message"
                        />
                      </FormControl>
                      <FormDescription>
                        Максимум 1000 символів
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={sendMutation.isPending}
                  data-testid="button-send-notification"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sendMutation.isPending ? "Надсилання..." : "Надіслати"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Шаблони повідомлень
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { title: "Нове надходження", text: "Нове надходження квітів з Кенії! Перегляньте каталог." },
                { title: "Акція", text: "Спеціальна пропозиція! Знижка -10% на всі троянди до кінця тижня." },
                { title: "Свято", text: "Нагадуємо про наближення свята. Зробіть замовлення заздалегідь!" },
              ].map((template, i) => (
                <div 
                  key={i}
                  className="p-3 rounded-lg border hover-elevate cursor-pointer"
                  onClick={() => form.setValue("message", template.text)}
                  data-testid={`template-${i}`}
                >
                  <p className="font-medium text-sm">{template.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{template.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Статистика</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Останнє надсилання</span>
                <Badge variant="outline">
                  {sentCount > 0 ? `${sentCount} клієнтам` : "—"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Всього за місяць</span>
                <Badge variant="outline">0 повідомлень</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
