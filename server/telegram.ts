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

  bot.command('loyalty', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const customers = await storage.getCustomers();
    const customer = customers.find(c => c.telegramId === telegramId);

    if (!customer) {
      return ctx.reply('Ви ще не зареєстровані в системі.');
    }

    const points = customer.loyaltyPoints || 0;
    const ordersCount = customer.totalOrders || 0;
    
    let message = `🏆 Ваша програма лояльності:\n\n`;
    message += `💰 Баланс: ${points} балів\n`;
    message += `📦 Всього замовлень: ${ordersCount}\n`;
    message += `💳 Витрачено: ${customer.totalSpent} грн\n\n`;
    
    message += `🎁 Наступні бонуси:\n`;
    if (points < 100) {
      message += `• Подарунок за 100 балів (вам залишилось ${100 - points})\n`;
    } else {
      message += `• Вам доступний подарунок! 🎁 Зверніться до менеджера.\n`;
    }
    
    const nextFreeOrder = 10 - (ordersCount % 10);
    if (nextFreeOrder === 10 && ordersCount > 0) {
      message += `• Наступне замовлення зі знижкою 1000 грн! 💸\n`;
    } else {
      message += `• Знижка 1000 грн на кожне 11-те замовлення (залишилось ${nextFreeOrder})\n`;
    }
    
    ctx.reply(message);
  });

  bot.command('catalog', async (ctx) => {
    const products = await storage.getProducts();
    const types = await storage.getFlowerTypes();
    
    if (products.length === 0) {
      return ctx.reply('Каталог наразі порожній.');
    }

    let message = '🌿 Наш каталог товарів:\n\n';
    
    // Group by flower type
    for (const type of types) {
      const typeProducts = products.filter(p => p.typeId === type.id && p.status === 'available');
      if (typeProducts.length > 0) {
        message += `📍 ${type.name}:\n`;
        typeProducts.forEach(p => {
          const price = p.priceUah ? `${p.priceUah} грн` : `$${p.priceUsd}`;
          message += `  • ${p.name} (${p.variety}) — ${price}\n`;
        });
        message += '\n';
      }
    }
    
    ctx.reply(message + 'Для замовлення напишіть менеджеру або залиште запит через /order');
  });

  bot.command('order', (ctx) => {
    ctx.reply('Будь ласка, напишіть що ви хочете замовити та ваш номер телефону. Наш менеджер зв\'яжеться з вами найближчим часом! 🌸');
  });

  bot.on('text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    
    // Simple way to handle "feedback" or "manual order"
    const telegramId = ctx.from.id.toString();
    const message = ctx.message.text;
    
    console.log(`Telegram feedback from ${telegramId}: ${message}`);
    ctx.reply('Дякуємо! Ваше повідомлення передано менеджеру. Ми зв\'яжемось з вами скоро. ✅');
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
