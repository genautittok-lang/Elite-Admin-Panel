import { Telegraf } from 'telegraf';
import { storage } from './storage';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.warn("TELEGRAM_BOT_TOKEN is not set. Telegram bot will not start.");
}

export const bot = token ? new Telegraf(token) : null;

if (bot) {
  bot.start((ctx) => {
    ctx.reply('Ласкаво просимо до FlowerB2B! 🌸\n\nЯ — ваш помічник для замовлення квітів оптом.\n\nКоманди:\n/catalog — Переглянути актуальний каталог\n/status — Перевірити статус моїх замовлень\n/loyalty — Мій баланс та бонуси');
  });

  bot.command('catalog', async (ctx) => {
    const products = await storage.getProducts();
    const available = products.filter(p => p.status === 'available').slice(0, 10);
    
    if (available.length === 0) {
      return ctx.reply('На жаль, зараз немає доступних товарів у каталозі.');
    }

    let message = '🌿 Актуальний каталог (ТОП-10):\n\n';
    available.forEach(p => {
      const price = p.priceUah ? `${p.priceUah} грн` : `$${p.priceUsd}`;
      message += `• ${p.name} (${p.variety}) — ${price}\n`;
    });
    
    ctx.reply(message + '\nДля повного замовлення зверніться до менеджера.');
  });

  bot.command('loyalty', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const customers = await storage.getCustomers();
    const customer = customers.find(c => c.telegramId === telegramId);

    if (!customer) {
      return ctx.reply('Ви ще не зареєстровані в системі.');
    }

    ctx.reply(`🏆 Програма лояльності:\n\nВаш баланс: ${customer.loyaltyPoints} балів\nВсього витрачено: ${customer.totalSpent} грн\nВсього замовлень: ${customer.totalOrders}`);
  });

  bot.command('status', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const customers = await storage.getCustomers();
    const customer = customers.find(c => c.telegramId === telegramId);

    if (!customer) {
      return ctx.reply('Ви ще не зареєстровані в системі. Будь ласка, зверніться до адміністратора.');
    }

    const orders = await storage.getCustomerOrders(customer.id);
    if (orders.length === 0) {
      return ctx.reply('У вас ще немає замовлень.');
    }

    const latestOrder = orders[0];
    ctx.reply(`Останнє замовлення: ${latestOrder.orderNumber}\nСтатус: ${latestOrder.status}\nСума: ${latestOrder.totalUah} грн`);
  });

  bot.launch().then(() => {
    console.log('Telegram bot started successfully');
  }).catch((err) => {
    console.error('Failed to start Telegram bot:', err);
  });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

export async function sendOrderNotification(orderId: string) {
  if (!bot) return;
  try {
    const order = await storage.getOrder(orderId);
    if (!order || !order.customer?.telegramId) return;

    const message = `🔔 Оновлення статусу замовлення ${order.orderNumber}!\nНовий статус: ${order.status}`;
    await bot.telegram.sendMessage(order.customer.telegramId, message);
  } catch (error) {
    console.error('Failed to send order notification:', error);
  }
}

export async function sendBulkNotification(message: string, telegramIds: string[]) {
  if (!bot) return;
  for (const id of telegramIds) {
    try {
      await bot.telegram.sendMessage(id, message);
    } catch (error) {
      console.error(`Failed to send notification to ${id}:`, error);
    }
  }
}
