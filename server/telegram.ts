import { Telegraf, Markup, Context } from 'telegraf';
import { storage } from './storage';
import type { Product, Customer, Country, FlowerType } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';

const token = process.env.TELEGRAM_BOT_TOKEN;
console.log("Telegram: checking token...", token ? "Token found" : "Token missing");
if (!token) {
  console.warn("TELEGRAM_BOT_TOKEN is not set. Telegram bot will not start.");
}

export const bot = token ? new Telegraf(token) : null;
console.log("Telegram: bot instance created:", bot ? "Yes" : "No");

// User session storage (in-memory with weak references or simple cleanup)
interface UserSession {
  language: 'ua' | 'en' | 'ru';
  city?: string;
  customerType?: 'flower_shop' | 'wholesale';
  cart: { productId: string; quantity: number }[];
  favorites: string[];
  step: 'language' | 'city' | 'type' | 'menu' | 'catalog' | 'product' | 'cart' | 'order' | 'checkout_name' | 'checkout_phone' | 'checkout_address' | 'awaiting_confirmation';
  currentCountry?: string;
  currentType?: string;
  currentProduct?: string;
  lastInteraction: number;
  checkoutData?: {
    name?: string;
    phone?: string;
    address?: string;
  };
}

const sessions: Map<string, UserSession> = new Map();

// Global caches for performance
let productsCache: any[] | null = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 30000; // 30 seconds

async function getCachedProducts() {
  const now = Date.now();
  if (!productsCache || (now - lastCacheUpdate) > CACHE_TTL) {
    productsCache = await storage.getProducts();
    lastCacheUpdate = now;
  }
  return productsCache;
}

function getSession(telegramId: string): UserSession {
  if (!sessions.has(telegramId)) {
    sessions.set(telegramId, {
      language: 'ua',
      cart: [],
      favorites: [],
      step: 'language',
      lastInteraction: Date.now()
    });
  }
  const session = sessions.get(telegramId)!;
  session.lastInteraction = Date.now();
  return session;
}

// Cleanup old sessions every hour
setInterval(() => {
  const now = Date.now();
  Array.from(sessions.entries()).forEach(([id, session]) => {
    if (now - session.lastInteraction > 24 * 60 * 60 * 1000) { // 24 hours
      sessions.delete(id);
    }
  });
}, 60 * 60 * 1000);

// Helper function to calculate price (async to get rate from settings)
async function calculatePriceAsync(product: Product, session: UserSession): Promise<number> {
  let price = 0;
  
  if (product.catalogType === 'instock') {
    price = parseFloat(product.priceUah?.toString() || '0');
  } else {
    // Preorder: convert USD to UAH using rate from settings
    const usdPrice = parseFloat(product.priceUsd?.toString() || '0');
    const rateSetting = await storage.getSetting('usd_to_uah_rate');
    const rate = parseFloat(rateSetting?.value || '41.5');
    price = usdPrice * rate;
  }
  
  // Apply wholesale discount
  if (session.customerType === 'wholesale') {
    price = price * 0.95; // -5%
  }
  
  return Math.round(price * 100) / 100;
}

// Sync version for non-async contexts (uses cached rate with periodic refresh)
let cachedRate = 41.5;
async function refreshCachedRate() {
  const setting = await storage.getSetting('usd_to_uah_rate');
  if (setting) cachedRate = parseFloat(setting.value);
}
refreshCachedRate();
// Refresh rate every 60 seconds to pick up admin changes
setInterval(refreshCachedRate, 60000);

function calculatePrice(product: Product, session: UserSession): number {
  let price = 0;
  
  if (product.catalogType === 'instock') {
    price = parseFloat(product.priceUah?.toString() || '0');
  } else {
    const usdPrice = parseFloat(product.priceUsd?.toString() || '0');
    price = usdPrice * cachedRate;
  }
  
  if (session.customerType === 'wholesale') {
    price = price * 0.95;
  }
  
  return Math.round(price * 100) / 100;
}

// Translations
const t = {
  ua: {
    welcome: (name: string) => `Вітаємо, ${name}! 🌸\n\nТут ви можете:\n✅ Переглянути асортимент\n✅ Дізнатися персональні ціни\n✅ Оформити замовлення\n✅ Накопичити бонуси\n\nОберіть пункт меню:`,
    selectLanguage: '🌐 Оберіть мову / Select language:',
    selectCity: '📍 Введіть ваше місто:',
    selectType: '🏪 Оберіть тип клієнта:',
    flowerShop: '🌹 Квітковий магазин',
    wholesale: '📦 Великий опт (від 3000$) -5%',
    mainMenu: '📋 Головне меню',
    catalog: '🌹 Каталог',
    promotions: '🔥 Акції',
    favorites: '❤️ Обране',
    cart: '🧺 Кошик',
    search: '🔍 Пошук',
    manager: '📞 Менеджер',
    history: '📦 Історія замовлень',
    settings: '⚙️ Налаштування',
    about: 'ℹ️ Про компанію',
    loyalty: '🏆 Бонуси',
    back: '◀️ Назад',
    preorder: '📋 Передзамовлення',
    instock: '✅ В наявності',
    addToCart: '🧺 В кошик',
    addToFavorites: '❤️ В обране',
    removeFromFavorites: '💔 Видалити з обраного',
    cartEmpty: '🧺 Ваш кошик порожній',
    cartItems: '🧺 Ваш кошик:',
    total: '💰 Всього:',
    minOrder: '⚠️ Мінімальна сума замовлення: 5000 грн',
    checkout: '✅ Оформити заявку',
    clearCart: '🗑️ Очистити кошик',
    orderSuccess: '✅ Заявку прийнято! Менеджер зв\'яжеться з вами найближчим часом.',
    noProducts: 'Товари не знайдено',
    noHistory: 'У вас ще немає замовлень',
    noFavorites: 'Обране порожнє',
    stem: 'шт',
    box: 'упак',
    available: '🟢 В наявності',
    preorderStatus: '🟡 Під замовлення',
    expected: '🔵 Очікується',
    height: 'Висота',
    color: 'Колір',
    class: 'Клас',
    price: 'Ціна',
    country: 'Країна',
    plantation: 'Плантація',
    managerContact: '📞 Зв\'яжіться з нашим менеджером:\n\nТелефон: +380 XX XXX XX XX\nEmail: manager@flowerb2b.com',
    aboutText: 'ℹ️ FlowerB2B - оптовий продаж квітів\n\n🌸 Працюємо з 2010 року\n🌍 Імпорт з 6 країн\n🚚 Доставка по Україні\n💐 Понад 500 сортів',
    loyaltyInfo: (points: number, orders: number) => {
      let msg = `🏆 Програма лояльності:\n\n💰 Ваш баланс: ${points} балів\n📦 Замовлень: ${orders}\n\n`;
      msg += `📌 Правила:\n• 1 бал = 1000 грн покупок\n• 100 балів = подарунок\n• Кожне 11-те замовлення: -1000 грн\n\n`;
      if (points >= 100) {
        msg += `🎁 Вітаємо! Вам доступний подарунок!`;
      } else {
        msg += `До подарунка: ${100 - points} балів`;
      }
      return msg;
    },
    settingsMenu: '⚙️ Налаштування:\n\nОберіть що змінити:',
    changeLanguage: '🌐 Змінити мову',
    changeCity: '📍 Змінити місто',
    changeType: '🏪 Змінити тип клієнта',
    quantity: 'Кількість'
  },
  en: {
    welcome: (name: string) => `Welcome, ${name}! 🌸\n\nHere you can:\n✅ Browse assortment\n✅ Check personal prices\n✅ Place orders\n✅ Earn bonuses\n\nSelect a menu item:`,
    selectLanguage: '🌐 Оберіть мову / Select language:',
    selectCity: '📍 Enter your city:',
    selectType: '🏪 Select customer type:',
    flowerShop: '🌹 Flower Shop',
    wholesale: '📦 Wholesale (from $3000) -5%',
    mainMenu: '📋 Main Menu',
    catalog: '🌹 Catalog',
    promotions: '🔥 Promotions',
    favorites: '❤️ Favorites',
    cart: '🧺 Cart',
    search: '🔍 Search',
    manager: '📞 Manager',
    history: '📦 Order History',
    settings: '⚙️ Settings',
    about: 'ℹ️ About',
    loyalty: '🏆 Bonuses',
    back: '◀️ Back',
    preorder: '📋 Pre-order',
    instock: '✅ In Stock',
    addToCart: '🧺 Add to Cart',
    addToFavorites: '❤️ Add to Favorites',
    removeFromFavorites: '💔 Remove from Favorites',
    cartEmpty: '🧺 Your cart is empty',
    cartItems: '🧺 Your cart:',
    total: '💰 Total:',
    minOrder: '⚠️ Minimum order: 5000 UAH',
    checkout: '✅ Place Order',
    clearCart: '🗑️ Clear Cart',
    orderSuccess: '✅ Order received! Manager will contact you soon.',
    noProducts: 'No products found',
    noHistory: 'No orders yet',
    noFavorites: 'Favorites empty',
    stem: 'pcs',
    box: 'box',
    available: '🟢 Available',
    preorderStatus: '🟡 Pre-order',
    expected: '🔵 Expected',
    height: 'Height',
    color: 'Color',
    class: 'Class',
    price: 'Price',
    country: 'Country',
    plantation: 'Plantation',
    managerContact: '📞 Contact our manager:\n\nPhone: +380 XX XXX XX XX\nEmail: manager@flowerb2b.com',
    aboutText: 'ℹ️ FlowerB2B - Wholesale Flowers\n\n🌸 Since 2010\n🌍 Import from 6 countries\n🚚 Delivery across Ukraine\n💐 Over 500 varieties',
    loyaltyInfo: (points: number, orders: number) => {
      let msg = `🏆 Loyalty Program:\n\n💰 Balance: ${points} points\n📦 Orders: ${orders}\n\n`;
      msg += `📌 Rules:\n• 1 point = 1000 UAH spent\n• 100 points = gift\n• Every 11th order: -1000 UAH\n\n`;
      if (points >= 100) {
        msg += `🎁 Congratulations! Gift available!`;
      } else {
        msg += `Until gift: ${100 - points} points`;
      }
      return msg;
    },
    settingsMenu: '⚙️ Settings:\n\nSelect option:',
    changeLanguage: '🌐 Change Language',
    changeCity: '📍 Change City',
    changeType: '🏪 Change Type',
    quantity: 'Quantity'
  },
  ru: {
    welcome: (name: string) => `Приветствуем, ${name}! 🌸\n\nЗдесь вы можете:\n✅ Посмотреть ассортимент\n✅ Узнать персональные цены\n✅ Оформить заказ\n✅ Накопить бонусы\n\nВыберите пункт меню:`,
    selectLanguage: '🌐 Оберіть мову / Select language:',
    selectCity: '📍 Введите ваш город:',
    selectType: '🏪 Выберите тип клиента:',
    flowerShop: '🌹 Цветочный магазин',
    wholesale: '📦 Крупный опт (от 3000$) -5%',
    mainMenu: '📋 Главное меню',
    catalog: '🌹 Каталог',
    promotions: '🔥 Акции',
    favorites: '❤️ Избранное',
    cart: '🧺 Корзина',
    search: '🔍 Поиск',
    manager: '📞 Менеджер',
    history: '📦 История заказов',
    settings: '⚙️ Настройки',
    about: 'ℹ️ О компании',
    loyalty: '🏆 Бонусы',
    back: '◀️ Назад',
    preorder: '📋 Предзаказ',
    instock: '✅ В наличии',
    addToCart: '🧺 В корзину',
    addToFavorites: '❤️ В избранное',
    removeFromFavorites: '💔 Удалить из избранного',
    cartEmpty: '🧺 Корзина пуста',
    cartItems: '🧺 Ваша корзина:',
    total: '💰 Итого:',
    minOrder: '⚠️ Минимальная сумма заказа: 5000 грн',
    checkout: '✅ Оформить заявку',
    clearCart: '🗑️ Очистить корзину',
    orderSuccess: '✅ Заявка принята! Менеджер свяжется с вами в ближайшее время.',
    noProducts: 'Товары не найдены',
    noHistory: 'Заказов пока нет',
    noFavorites: 'Избранное пусто',
    stem: 'шт',
    box: 'уп',
    available: '🟢 В наличии',
    preorderStatus: '🟡 Под заказ',
    expected: '🔵 Ожидается',
    height: 'Высота',
    color: 'Цвет',
    class: 'Класс',
    price: 'Цена',
    country: 'Страна',
    plantation: 'Плантация',
    managerContact: '📞 Свяжитесь с нашим менеджером:\n\nТелефон: +380 XX XXX XX XX\nEmail: manager@flowerb2b.com',
    aboutText: 'ℹ️ FlowerB2B - оптовая продажа цветов\n\n🌸 Работаем с 2010 года\n🌍 Импорт из 6 стран\n🚚 Доставка по Украине\n💐 Более 500 сортов',
    loyaltyInfo: (points: number, orders: number) => {
      let msg = `🏆 Программа лояльности:\n\n💰 Ваш баланс: ${points} баллов\n📦 Заказов: ${orders}\n\n`;
      msg += `📌 Правила:\n• 1 балл = 1000 грн покупок\n• 100 баллов = подарок\n• Каждый 11-й заказ: -1000 грн\n\n`;
      if (points >= 100) {
        msg += `🎁 Поздравляем! Вам доступен подарок!`;
      } else {
        msg += `До подарка: ${100 - points} баллов`;
      }
      return msg;
    },
    settingsMenu: '⚙️ Настройки:\n\nВыберите опцию:',
    changeLanguage: '🌐 Сменить язык',
    changeCity: '📍 Сменить город',
    changeType: '🏪 Сменить тип клиента',
    quantity: 'Количество'
  }
};

function getText(session: UserSession) {
  return t[session.language] || t.ua;
}

// Country flags
const countryFlags: Record<string, string> = {
  'KE': '🇰🇪',
  'EC': '🇪🇨',
  'CO': '🇨🇴',
  'IT': '🇮🇹',
  'NL': '🇳🇱',
  'CL': '🇨🇱'
};

// Helper function to show main menu
async function showMainMenu(ctx: Context, session: UserSession) {
  const txt = getText(session);
  const firstName = ctx.from?.first_name || 'User';
  
  await ctx.reply(
    txt.welcome(firstName),
    Markup.inlineKeyboard([
      [Markup.button.callback(txt.catalog, 'catalog'), Markup.button.callback(txt.promotions, 'promotions')],
      [Markup.button.callback(txt.favorites, 'favorites'), Markup.button.callback(txt.cart, 'cart')],
      [Markup.button.callback(txt.history, 'history'), Markup.button.callback(txt.loyalty, 'loyalty')],
      [Markup.button.callback(txt.manager, 'manager'), Markup.button.callback(txt.settings, 'settings')],
      [Markup.button.callback(txt.about, 'about')]
    ])
  );
}

// Helper function to send product card
async function sendProductCard(ctx: Context, product: Product, session: UserSession, isPromo = false) {
  const txt = getText(session);
  const price = await calculatePriceAsync(product, session);
  
  const statusMap: Record<string, string> = {
    available: txt.available,
    preorder: txt.preorderStatus,
    expected: txt.expected
  };
  
  // Short product ID for callbacks (first 8 chars of UUID)
  const shortId = product.id.substring(0, 8);
  
  // Build beautiful product card
  let message = '';
  if (isPromo) message += '🔥 *АКЦІЯ!*\n';
  message += `*${product.name}*\n`;
  message += `_${product.variety}_\n\n`;
  message += `├ ${txt.class}: ${product.flowerClass}\n`;
  message += `├ ${txt.height}: ${product.height} см\n`;
  message += `├ ${txt.color}: ${product.color}\n`;
  message += `└ ${statusMap[product.status] || product.status}\n\n`;
  message += `💰 *${price.toLocaleString('uk-UA')} грн* / ${product.packSize || 25} ${txt.stem}`;
  
  if (session.customerType === 'wholesale') {
    message += `\n🏷️ _Ваша знижка: -5%_`;
  }
  
  const buttons = Markup.inlineKeyboard([
    [
      Markup.button.callback('📦 +1', `c_1_${shortId}`),
      Markup.button.callback('📦 +5', `c_5_${shortId}`),
      Markup.button.callback('📦 +10', `c_10_${shortId}`)
    ],
    [
      Markup.button.callback('❤️ Обране', `f_${shortId}`),
      Markup.button.callback('🧺 Кошик', 'cart')
    ]
  ]);
  
  // Send photo if available
  if (product.images && product.images.length > 0) {
    const imagePath = product.images[0];
    try {
      // Get base URL for production (Railway provides RAILWAY_PUBLIC_DOMAIN)
      const baseUrl = process.env.BASE_URL || 
                      (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null);
      
      // For /uploads/ path in production, use public URL
      if (imagePath.startsWith('/uploads/') && baseUrl) {
        const imageUrl = `${baseUrl}${imagePath}`;
        await ctx.replyWithPhoto(imageUrl, {
          caption: message,
          parse_mode: 'Markdown',
          reply_markup: buttons.reply_markup
        });
        return;
      }
      
      // Check if it's a local file path (attached_assets, uploads in dev)
      if (imagePath.startsWith('attached_assets/') || imagePath.startsWith('./') || imagePath.startsWith('/uploads/')) {
        // For /uploads/ path, strip the leading slash
        const relativePath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
        const fullPath = path.resolve(process.cwd(), relativePath);
        if (fs.existsSync(fullPath)) {
          await ctx.replyWithPhoto(
            { source: fullPath },
            { caption: message, parse_mode: 'Markdown', reply_markup: buttons.reply_markup }
          );
          return;
        }
      }
      // Try as URL
      await ctx.replyWithPhoto(imagePath, {
        caption: message,
        parse_mode: 'Markdown',
        reply_markup: buttons.reply_markup
      });
    } catch (err) {
      console.error('Failed to send photo:', err);
      await ctx.reply(message, { parse_mode: 'Markdown', ...buttons });
    }
  } else {
    await ctx.reply(message, { parse_mode: 'Markdown', ...buttons });
  }
}

if (bot) {
  // Start command - check if user exists, skip onboarding if yes
  bot.start(async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const session = getSession(telegramId);
    
    // Check if customer already exists in database
    const customers = await storage.getCustomers();
    const existingCustomer = customers.find(c => c.telegramId === telegramId);
    
    if (existingCustomer) {
      // Restore session from customer data
      session.language = (existingCustomer.language as 'ua' | 'en' | 'ru') || 'ua';
      session.city = existingCustomer.city || '';
      session.customerType = (existingCustomer.customerType as 'flower_shop' | 'wholesale') || 'flower_shop';
      session.step = 'menu';
      
      // Go directly to main menu
      await showMainMenu(ctx, session);
      return;
    }
    
    // New user - start onboarding
    session.step = 'language';
    
    await ctx.reply(
      t.ua.selectLanguage,
      Markup.inlineKeyboard([
        [Markup.button.callback('🇺🇦 Українська', 'lang_ua')],
        [Markup.button.callback('🇬🇧 English', 'lang_en')],
        [Markup.button.callback('🇷🇺 Русский', 'lang_ru')]
      ])
    );
  });

  // Language selection
  bot.action(/^lang_(.+)$/, async (ctx) => {
    const lang = ctx.match[1] as 'ua' | 'en' | 'ru';
    const telegramId = ctx.from!.id.toString();
    const session = getSession(telegramId);
    session.language = lang;
    session.step = 'city';
    
    const txt = getText(session);
    await ctx.answerCbQuery();
    await ctx.editMessageText(txt.selectCity);
  });

  // Text input handler (city, search, checkout)
  bot.on('text', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const session = getSession(telegramId);
    const txt = getText(session);
    
    if (session.step === 'city') {
      session.city = ctx.message.text;
      session.step = 'type';
      
      await ctx.reply(
        txt.selectType,
        Markup.inlineKeyboard([
          [Markup.button.callback(txt.flowerShop, 'cust_flower_shop')],
          [Markup.button.callback(txt.wholesale, 'cust_wholesale')]
        ])
      );
    } else if (session.step === 'checkout_name') {
      // Collect name
      session.checkoutData = session.checkoutData || {};
      session.checkoutData.name = ctx.message.text;
      session.step = 'checkout_phone';
      
      await ctx.reply(
        '📞 Введіть ваш *номер телефону*:',
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Скасувати', 'cart')]
        ])}
      );
    } else if (session.step === 'checkout_phone') {
      // Collect phone
      session.checkoutData = session.checkoutData || {};
      session.checkoutData.phone = ctx.message.text;
      session.step = 'checkout_address';
      
      await ctx.reply(
        '📍 Введіть *адресу доставки*:',
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Скасувати', 'cart')]
        ])}
      );
    } else if (session.step === 'checkout_address') {
      // Collect address and show summary
      session.checkoutData = session.checkoutData || {};
      session.checkoutData.address = ctx.message.text;
      session.step = 'awaiting_confirmation';
      
      // Calculate cart total for summary
      const products = await getCachedProducts();
      let total = 0;
      let itemsSummary = '';
      
      for (const item of session.cart) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const price = await calculatePriceAsync(product, session);
          total += price * item.quantity;
          itemsSummary += `• ${product.name} x${item.quantity}\n`;
        }
      }
      
      // Escape markdown special chars in user input
      const escapeMd = (text: string) => text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      
      // Show order summary for confirmation
      let summary = '📋 *ПІДТВЕРДЖЕННЯ ЗАМОВЛЕННЯ*\n';
      summary += '━━━━━━━━━━━━━━━━━━\n\n';
      summary += `👤 *Ім\'я:* ${escapeMd(session.checkoutData.name || '')}\n`;
      summary += `📞 *Телефон:* ${escapeMd(session.checkoutData.phone || '')}\n`;
      summary += `📍 *Адреса:* ${escapeMd(session.checkoutData.address || '')}\n\n`;
      summary += `📦 *Товари:*\n${itemsSummary}\n`;
      summary += `💵 *Сума:* ${total.toLocaleString('uk-UA')} грн\n`;
      
      await ctx.reply(summary, { 
        parse_mode: 'Markdown', 
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Підтвердити', 'confirm_order')],
          [Markup.button.callback('✏️ Змінити дані', 'checkout')],
          [Markup.button.callback('❌ Скасувати', 'cart')]
        ])
      });
    } else if (session.step === 'menu') {
      // Search functionality
      const searchTerm = ctx.message.text.toLowerCase();
      const products = await getCachedProducts();
      const found = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm) || 
        p.variety.toLowerCase().includes(searchTerm)
      );
      
      if (found.length === 0) {
        await ctx.reply(txt.noProducts);
      } else {
        for (const product of found.slice(0, 5)) {
          await sendProductCard(ctx, product, session);
        }
      }
    }
  });

  // Customer type selection (onboarding - create customer)
  bot.action(/^cust_(flower_shop|wholesale)$/, async (ctx) => {
    const type = ctx.match[1] as 'flower_shop' | 'wholesale';
    const telegramId = ctx.from!.id.toString();
    const telegramUsername = ctx.from!.username || '';
    const session = getSession(telegramId);
    session.customerType = type;
    session.step = 'menu';
    
    // Create or update customer during onboarding
    const customers = await storage.getCustomers();
    let customer = customers.find(c => c.telegramId === telegramId);
    
    if (!customer) {
      customer = await storage.createCustomer({
        telegramId,
        telegramUsername,
        name: ctx.from!.first_name || 'Telegram User',
        phone: '',
        shopName: '',
        city: session.city || '',
        customerType: type,
        language: session.language,
        isBlocked: false
      });
    } else {
      await storage.updateCustomer(customer.id, {
        telegramUsername,
        city: session.city,
        customerType: type,
        language: session.language
      } as any);
    }
    
    await ctx.answerCbQuery();
    await showMainMenu(ctx, session);
  });

  // Main menu
  bot.action('menu', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    session.step = 'menu';
    await ctx.answerCbQuery();
    await showMainMenu(ctx, session);
  });

  // Catalog
  bot.action('catalog', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    await ctx.editMessageText(
      `${txt.catalog}\n\nОберіть розділ:`,
      Markup.inlineKeyboard([
        [Markup.button.callback(txt.preorder, 'catalog_preorder')],
        [Markup.button.callback(txt.instock, 'catalog_instock')],
        [Markup.button.callback(txt.back, 'menu')]
      ])
    );
  });

  // Catalog sections
  bot.action(/^catalog_(preorder|instock)$/, async (ctx) => {
    const catalogType = ctx.match[1];
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    const countries = await storage.getCountries();
    const buttons = countries.map(c => [
      Markup.button.callback(`${countryFlags[c.code] || ''} ${c.name}`, `country_${catalogType}_${c.id}`)
    ]);
    buttons.push([Markup.button.callback(txt.back, 'catalog')]);
    
    await ctx.editMessageText(
      `${txt.country}:`,
      Markup.inlineKeyboard(buttons)
    );
  });

  // Country selection
  bot.action(/^country_(.+)_(.+)$/, async (ctx) => {
    const [catalogType, countryId] = [ctx.match[1], ctx.match[2]];
    const session = getSession(ctx.from!.id.toString());
    session.currentCountry = countryId;
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    const types = await storage.getFlowerTypes();
    const buttons = types.map(t => [
      Markup.button.callback(t.name, `t_${catalogType === 'preorder' ? 'p' : 'i'}_${countryId.substring(0, 8)}_${t.id.substring(0, 8)}`)
    ]);
    buttons.push([Markup.button.callback(txt.back, `catalog_${catalogType}`)]);
    
    await ctx.editMessageText(
      `Тип квітів:`,
      Markup.inlineKeyboard(buttons)
    );
  });

  // Flower type selection - show products
  bot.action(/^t_(p|i)_(.+)_(.+)$/, async (ctx) => {
    const [catCode, countryPart, typePart] = [ctx.match[1], ctx.match[2], ctx.match[3]];
    const catalogType = catCode === 'p' ? 'preorder' : 'instock';
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    const products = await getCachedProducts();
    const filtered = products.filter(p => 
      p.countryId.startsWith(countryPart) && 
      p.typeId.startsWith(typePart) &&
      p.catalogType === catalogType
    );
    
    if (filtered.length === 0) {
      await ctx.reply(txt.noProducts);
      return;
    }
    
    // Send product cards
    for (const product of filtered.slice(0, 5)) {
      await sendProductCard(ctx, product, session);
    }
  });

  // Product actions - Add to cart (short format: c_<qty>_<shortId>)
  bot.action(/^c_(\d+)_(.+)$/, async (ctx) => {
    const quantity = parseInt(ctx.match[1]);
    const shortId = ctx.match[2];
    const session = getSession(ctx.from!.id.toString());
    
    // Find full product ID by matching prefix
    const products = await getCachedProducts();
    const product = products.find(p => p.id.startsWith(shortId));
    
    if (!product) {
      await ctx.answerCbQuery('Товар не знайдено');
      return;
    }
    
    const existing = session.cart.find(c => c.productId === product.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      session.cart.push({ productId: product.id, quantity });
    }
    
    const txt = getText(session);
    const totalInCart = session.cart.reduce((sum, item) => sum + item.quantity, 0);
    await ctx.answerCbQuery(`+${quantity} 📦 Всього: ${totalInCart} упак.`);
  });

  // Favorite toggle (short format: f_<shortId>)
  bot.action(/^f_(.+)$/, async (ctx) => {
    const shortId = ctx.match[1];
    const session = getSession(ctx.from!.id.toString());
    
    // Find full product ID by matching prefix
    const products = await getCachedProducts();
    const product = products.find(p => p.id.startsWith(shortId));
    
    if (!product) {
      await ctx.answerCbQuery('Товар не знайдено');
      return;
    }
    
    if (session.favorites.includes(product.id)) {
      session.favorites = session.favorites.filter(id => id !== product.id);
      await ctx.answerCbQuery('💔 Видалено з обраного');
    } else {
      session.favorites.push(product.id);
      await ctx.answerCbQuery('❤️ Додано до обраного!');
    }
  });

  // Favorites
  bot.action('favorites', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    if (session.favorites.length === 0) {
      await ctx.reply(txt.noFavorites, Markup.inlineKeyboard([
        [Markup.button.callback(txt.back, 'menu')]
      ]));
      return;
    }
    
    const products = await getCachedProducts();
    for (const productId of session.favorites) {
      const product = products.find(p => p.id === productId);
      if (product) {
        await sendProductCard(ctx, product, session);
      }
    }
  });

  // Cart
  bot.action('cart', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    const telegramId = ctx.from!.id.toString();
    await ctx.answerCbQuery();
    
    if (session.cart.length === 0) {
      await ctx.reply(
        '🧺 *Ваш кошик порожній*\n\nДодайте товари з каталогу!',
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🌹 Каталог', 'catalog')],
            [Markup.button.callback('◀️ Меню', 'menu')]
          ])
        }
      );
      return;
    }
    
    // Check for discount
    const customers = await storage.getCustomers();
    const customer = customers.find(c => c.telegramId === telegramId);
    const availableDiscount = parseFloat(customer?.nextOrderDiscount as any || '0');
    
    const products = await storage.getProducts();
    let total = 0;
    let message = '🧺 *ВАШ КОШИК*\n';
    message += '━━━━━━━━━━━━━━━━━━\n\n';
    
    let itemNum = 1;
    for (const item of session.cart) {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        const price = await calculatePriceAsync(product, session);
        const itemTotal = price * item.quantity;
        total += itemTotal;
        
        message += `*${itemNum}. ${product.name}*\n`;
        message += `   _${product.variety}_\n`;
        message += `   📦 ${item.quantity} упак. × ${price.toLocaleString('uk-UA')} грн\n`;
        message += `   💰 = *${itemTotal.toLocaleString('uk-UA')} грн*\n\n`;
        itemNum++;
      }
    }
    
    message += '━━━━━━━━━━━━━━━━━━\n';
    message += `💵 *ВСЬОГО: ${total.toLocaleString('uk-UA')} грн*`;
    
    if (session.customerType === 'wholesale') {
      message += `\n🏷️ _Оптова знижка -5% застосована_`;
    }
    
    // Show available discount
    if (availableDiscount > 0) {
      message += `\n\n🎁 *Ваша знижка: -${availableDiscount.toLocaleString('uk-UA')} грн*\n_Буде застосована при оформленні_`;
    }
    
    if (total < 5000) {
      message += `\n\n⚠️ Мін. замовлення: 5000 грн\n_До мінімуму: ${(5000 - total).toLocaleString('uk-UA')} грн_`;
    }
    
    const buttons = [];
    if (total >= 5000) {
      buttons.push([Markup.button.callback('✅ Оформити замовлення', 'checkout')]);
    }
    buttons.push([Markup.button.callback('🗑️ Очистити', 'clear_cart'), Markup.button.callback('🌹 Додати ще', 'catalog')]);
    buttons.push([Markup.button.callback('◀️ Меню', 'menu')]);
    
    await ctx.reply(message, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
  });

  // Clear cart
  bot.action('clear_cart', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    session.cart = [];
    await ctx.answerCbQuery('Кошик очищено');
    await showMainMenu(ctx, session);
  });

  // Checkout - start contact details collection
  bot.action('checkout', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    // Start collecting contact details
    session.step = 'checkout_name';
    session.checkoutData = {};
    
    await ctx.reply(
      '📝 *ОФОРМЛЕННЯ ЗАМОВЛЕННЯ*\n━━━━━━━━━━━━━━━━━━\n\nВведіть ваше *ім\'я та прізвище*:',
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Скасувати', 'cart')]
      ])}
    );
  });
  
  // Finalize checkout (after collecting contact details)
  bot.action('confirm_order', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    const telegramId = ctx.from!.id.toString();
    await ctx.answerCbQuery();
    
    // Create order in storage
    const products = await getCachedProducts();
    let total = 0;
    const items: { product: Product; quantity: number; price: number; total: number }[] = [];
    
    for (const item of session.cart) {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        const price = await calculatePriceAsync(product, session);
        const itemTotal = price * item.quantity;
        total += itemTotal;
        items.push({ product, quantity: item.quantity, price, total: itemTotal });
      }
    }
    
    // Find or create customer
    const customers = await storage.getCustomers();
    let customer = customers.find(c => c.telegramId === telegramId);
    const checkoutData = session.checkoutData || {};
    
    if (!customer) {
      customer = await storage.createCustomer({
        telegramId,
        telegramUsername: ctx.from!.username || '',
        name: checkoutData.name || ctx.from!.first_name || 'Telegram User',
        phone: checkoutData.phone || '',
        shopName: '',
        city: session.city || '',
        address: checkoutData.address || '',
        customerType: session.customerType || 'flower_shop',
        language: session.language,
        isBlocked: false
      });
    } else {
      // Update customer with new contact info
      await storage.updateCustomer(customer.id, {
        name: checkoutData.name || customer.name,
        phone: checkoutData.phone || customer.phone,
        address: checkoutData.address || customer.address,
        telegramUsername: ctx.from!.username || customer.telegramUsername
      } as any);
    }
    
    // Apply existing discount (from previous 10th order)
    let discountApplied = 0;
    const existingDiscount = parseFloat((customer?.nextOrderDiscount as any) || '0');
    if (existingDiscount > 0 && total > existingDiscount) {
      discountApplied = existingDiscount;
      total -= discountApplied;
    }
    
    // Create order with beautiful number
    const orderNumber = `FL-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    
    // Build order items description
    let itemsDescription = items.map(i => `${i.product.name} x${i.quantity}`).join(', ');
    if (itemsDescription.length > 200) {
      itemsDescription = itemsDescription.substring(0, 197) + '...';
    }
    
    const order = await storage.createOrder({
      orderNumber,
      customerId: customer.id,
      status: 'new',
      totalUah: total.toString(),
      comment: `${session.city || ''} | ${itemsDescription}${discountApplied > 0 ? ' | Знижка -' + discountApplied + ' грн' : ''}`
    });
    
    // Persist order items
    for (const item of items) {
      await storage.createOrderItem({
        orderId: order.id,
        productId: item.product.id,
        quantity: item.quantity,
        priceUah: item.price.toString(),
        totalUah: item.total.toString()
      });
    }
    
    // Update customer loyalty (1 point per 1000 UAH)
    const newTotalSpent = parseFloat(customer.totalSpent || '0') + total;
    const pointsEarned = Math.floor(total / 1000);
    const newPoints = (customer.loyaltyPoints || 0) + pointsEarned;
    const newTotalOrders = (customer.totalOrders || 0) + 1;
    
    // Discount logic:
    // - If discount was applied this order, reset to 0
    // - If this is the 10th order (and no discount was just applied), set discount for next order
    let newNextOrderDiscount = '0';
    if (discountApplied > 0) {
      // Discount was used, reset to 0
      newNextOrderDiscount = '0';
    } else if (newTotalOrders % 10 === 0) {
      // This is 10th, 20th, 30th order - next order gets -1000 UAH
      newNextOrderDiscount = '1000';
    }
    
    await storage.updateCustomer(customer.id, {
      totalSpent: newTotalSpent.toString(),
      loyaltyPoints: newPoints,
      totalOrders: newTotalOrders,
      nextOrderDiscount: newNextOrderDiscount
    } as any);
    
    // Build bonus messages
    let bonusMessage = '';
    if (discountApplied > 0) {
      bonusMessage += `\n\n✅ *Застосовано знижку:* -${discountApplied.toLocaleString('uk-UA')} грн`;
    }
    if (newNextOrderDiscount === '1000') {
      bonusMessage += '\n\n🎁 *Вітаємо! Наступне замовлення зі знижкою 1000 грн!*';
    } else if (newPoints >= 100) {
      bonusMessage += '\n\n🎁 *Вітаємо! Ви накопичили 100+ балів!*\n_Вам доступний подарунок!_';
    }
    
    // Clear cart
    session.cart = [];
    
    await ctx.answerCbQuery();
    
    // Build beautiful order confirmation
    let confirmMessage = '✅ *ЗАМОВЛЕННЯ ПРИЙНЯТО!*\n';
    confirmMessage += '━━━━━━━━━━━━━━━━━━\n\n';
    confirmMessage += `📋 *Номер:* \`${orderNumber}\`\n\n`;
    
    for (const item of items) {
      confirmMessage += `• ${item.product.name}\n`;
      confirmMessage += `   ${item.quantity} упак. × ${item.price.toLocaleString('uk-UA')} грн\n`;
    }
    
    confirmMessage += '\n━━━━━━━━━━━━━━━━━━\n';
    confirmMessage += `💵 *СУМА:* ${total.toLocaleString('uk-UA')} грн\n`;
    confirmMessage += `🏆 *Бонуси:* +${pointsEarned} балів`;
    confirmMessage += bonusMessage;
    confirmMessage += '\n\n📞 _Менеджер зв\'яжеться з вами найближчим часом!_';
    
    await ctx.reply(confirmMessage, { 
      parse_mode: 'Markdown', 
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📦 Мої замовлення', 'history')],
        [Markup.button.callback('🌹 Головне меню', 'menu')]
      ]) 
    });
  });

  // Promotions
  bot.action('promotions', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    const products = await getCachedProducts();
    const promos = products.filter(p => p.isPromo);
    
    if (promos.length === 0) {
      await ctx.reply('Наразі немає акційних товарів', Markup.inlineKeyboard([
        [Markup.button.callback(txt.back, 'menu')]
      ]));
      return;
    }
    
    for (const product of promos.slice(0, 5)) {
      await sendProductCard(ctx, product, session, true);
    }
  });

  // History
  bot.action('history', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    const telegramId = ctx.from!.id.toString();
    await ctx.answerCbQuery();
    
    const customers = await storage.getCustomers();
    const customer = customers.find(c => c.telegramId === telegramId);
    
    if (!customer) {
      await ctx.reply(
        '📦 *ІСТОРІЯ ЗАМОВЛЕНЬ*\n━━━━━━━━━━━━━━━━━━\n\n_У вас ще немає замовлень_\n\nОформіть перше замовлення!',
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
          [Markup.button.callback('🌹 Каталог', 'catalog')],
          [Markup.button.callback('◀️ Меню', 'menu')]
        ])}
      );
      return;
    }
    
    const orders = await storage.getCustomerOrders(customer.id);
    
    if (orders.length === 0) {
      await ctx.reply(
        '📦 *ІСТОРІЯ ЗАМОВЛЕНЬ*\n━━━━━━━━━━━━━━━━━━\n\n_У вас ще немає замовлень_\n\nОформіть перше замовлення!',
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
          [Markup.button.callback('🌹 Каталог', 'catalog')],
          [Markup.button.callback('◀️ Меню', 'menu')]
        ])}
      );
      return;
    }
    
    const statusEmojis: Record<string, string> = {
      new: '🆕',
      confirmed: '✅',
      processing: '⚙️',
      shipped: '🚚',
      completed: '✨',
      cancelled: '❌'
    };
    
    const statusNames: Record<string, string> = {
      new: 'Нове',
      confirmed: 'Підтверджено',
      processing: 'В обробці',
      shipped: 'Відправлено',
      completed: 'Завершено',
      cancelled: 'Скасовано'
    };
    
    let message = '📦 *ІСТОРІЯ ЗАМОВЛЕНЬ*\n';
    message += '━━━━━━━━━━━━━━━━━━\n\n';
    
    for (const order of orders.slice(0, 10)) {
      const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('uk-UA') : '';
      const emoji = statusEmojis[order.status] || '📋';
      const status = statusNames[order.status] || order.status;
      
      message += `${emoji} *${order.orderNumber}*\n`;
      message += `   📅 ${date}\n`;
      message += `   💰 ${parseFloat(order.totalUah).toLocaleString('uk-UA')} грн\n`;
      message += `   📌 _${status}_\n\n`;
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('🌹 Каталог', 'catalog')],
      [Markup.button.callback('◀️ Меню', 'menu')]
    ])});
  });

  // Manager
  bot.action('manager', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    await ctx.reply(txt.managerContact, Markup.inlineKeyboard([
      [Markup.button.callback(txt.back, 'menu')]
    ]));
  });

  // About
  bot.action('about', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    await ctx.reply(txt.aboutText, Markup.inlineKeyboard([
      [Markup.button.callback(txt.back, 'menu')]
    ]));
  });

  // Loyalty
  bot.action('loyalty', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    const telegramId = ctx.from!.id.toString();
    await ctx.answerCbQuery();
    
    const customers = await storage.getCustomers();
    const customer = customers.find(c => c.telegramId === telegramId);
    
    const points = customer?.loyaltyPoints || 0;
    const orders = customer?.totalOrders || 0;
    
    await ctx.reply(txt.loyaltyInfo(points, orders), Markup.inlineKeyboard([
      [Markup.button.callback(txt.back, 'menu')]
    ]));
  });

  // Settings
  bot.action('settings', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    await ctx.reply(
      txt.settingsMenu,
      Markup.inlineKeyboard([
        [Markup.button.callback(txt.changeLanguage, 'change_lang')],
        [Markup.button.callback(txt.changeCity, 'change_city')],
        [Markup.button.callback(txt.changeType, 'change_type')],
        [Markup.button.callback(txt.back, 'menu')]
      ])
    );
  });

  bot.action('change_lang', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      t.ua.selectLanguage,
      Markup.inlineKeyboard([
        [Markup.button.callback('🇺🇦 Українська', 'set_lang_ua')],
        [Markup.button.callback('🇬🇧 English', 'set_lang_en')],
        [Markup.button.callback('🇷🇺 Русский', 'set_lang_ru')]
      ])
    );
  });

  bot.action(/^set_lang_(.+)$/, async (ctx) => {
    const lang = ctx.match[1] as 'ua' | 'en' | 'ru';
    const session = getSession(ctx.from!.id.toString());
    session.language = lang;
    await ctx.answerCbQuery('Мову змінено!');
    await showMainMenu(ctx, session);
  });

  bot.action('change_city', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    session.step = 'city';
    const txt = getText(session);
    await ctx.answerCbQuery();
    await ctx.reply(txt.selectCity);
  });

  bot.action('change_type', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    await ctx.answerCbQuery();
    await ctx.reply(
      txt.selectType,
      Markup.inlineKeyboard([
        [Markup.button.callback(txt.flowerShop, 'set_type_flower_shop')],
        [Markup.button.callback(txt.wholesale, 'set_type_wholesale')]
      ])
    );
  });

  bot.action(/^set_type_(.+)$/, async (ctx) => {
    const type = ctx.match[1] as 'flower_shop' | 'wholesale';
    const session = getSession(ctx.from!.id.toString());
    session.customerType = type;
    await ctx.answerCbQuery('Тип змінено!');
    await showMainMenu(ctx, session);
  });

  // Launch bot
  console.log("Telegram: attempting to launch bot...");
  bot.launch().then(() => {
    console.log('Telegram bot started successfully');
  }).catch((err) => {
    console.error('Failed to start Telegram bot:', err);
  });

  // Graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// Export functions for routes
export async function sendOrderNotification(orderId: string) {
  if (!bot) return;
  try {
    const order = await storage.getOrder(orderId);
    if (!order || !order.customer?.telegramId) return;

    const statusMap: Record<string, string> = {
      new: 'Нова',
      confirmed: 'Підтверджена',
      processing: 'В роботі',
      shipped: 'Відправлена',
      completed: 'Закрита',
      cancelled: 'Скасована'
    };

    const message = `🔔 Статус замовлення ${order.orderNumber} змінено на: *${statusMap[order.status] || order.status}*`;
    await bot.telegram.sendMessage(order.customer.telegramId, message, { parse_mode: 'Markdown' });
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
