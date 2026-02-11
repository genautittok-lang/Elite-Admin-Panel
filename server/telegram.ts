import { Telegraf, Markup, Context } from 'telegraf';
import { storage } from './storage';
import type { Product, Customer, Country, FlowerType } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';

// Helper to check if URL is accessible (for Railway ephemeral storage)
async function isUrlAccessible(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.log('');
  console.log('⚠️  TELEGRAM_BOT_TOKEN not set - bot disabled');
  console.log('');
}

export const bot = token ? new Telegraf(token) : null;

// User session storage (in-memory with weak references or simple cleanup)
interface UserSession {
  language: 'ua' | 'en' | 'ru';
  city?: string;
  customerType?: 'flower_shop' | 'wholesale';
  cart: { productId: string; quantity: number }[];
  favorites: string[];
  step: 'language' | 'city' | 'type' | 'menu' | 'catalog' | 'product' | 'cart' | 'order' | 'checkout_name' | 'checkout_phone' | 'checkout_address' | 'checkout_packaging' | 'checkout_select_packaging' | 'awaiting_confirmation' | 'search';
  currentCountry?: string;
  currentFarm?: string;
  currentType?: string;
  currentProduct?: string;
  currentCatalogType?: 'preorder' | 'instock';
  filters?: {
    flowerClass?: string;
    height?: string;
    color?: string;
  };
  lastInteraction: number;
  checkoutData?: {
    name?: string;
    phone?: string;
    address?: string;
    needsPackaging?: boolean;
  };
  messagesToDelete: number[];
  selectedHeights?: { [productId: string]: string };
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
      lastInteraction: Date.now(),
      messagesToDelete: []
    });
  }
  const session = sessions.get(telegramId)!;
  session.lastInteraction = Date.now();
  if (!session.messagesToDelete) session.messagesToDelete = [];
  return session;
}

function registerMessage(session: UserSession, messageId: number | undefined) {
  if (messageId && !session.messagesToDelete.includes(messageId)) {
    session.messagesToDelete.push(messageId);
  }
}

async function clearOldMessages(ctx: Context, session: UserSession) {
  if (!session.messagesToDelete || session.messagesToDelete.length === 0) return;
  
  for (const msgId of session.messagesToDelete) {
    try {
      await ctx.telegram.deleteMessage(ctx.chat!.id, msgId);
    } catch (e) {
      // Ignore if message already deleted or too old
    }
  }
  session.messagesToDelete = [];
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
  
  // Always convert from USD to UAH using rate from settings
  const usdPrice = parseFloat(product.priceUsd?.toString() || '0');
  if (usdPrice > 0) {
    const rateSetting = await storage.getSetting('usd_to_uah_rate');
    const rate = parseFloat(rateSetting?.value || '41.5');
    price = usdPrice * rate;
  } else {
    // Fallback to priceUah if no USD price
    price = parseFloat(product.priceUah?.toString() || '0');
  }
  
  // Apply promo discount if active
  const promoPercent = (product as any).promoPercent || 0;
  const promoEndDate = (product as any).promoEndDate;
  const isPromoActive = product.isPromo && promoPercent > 0 && 
    (!promoEndDate || new Date(promoEndDate) > new Date());
  
  if (isPromoActive) {
    price = price * (1 - promoPercent / 100);
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
  
  // Apply promo discount if active
  const promoPercent = (product as any).promoPercent || 0;
  const promoEndDate = (product as any).promoEndDate;
  const isPromoActive = product.isPromo && promoPercent > 0 && 
    (!promoEndDate || new Date(promoEndDate) > new Date());
  
  if (isPromoActive) {
    price = price * (1 - promoPercent / 100);
  }
  
  if (session.customerType === 'wholesale') {
    price = price * 0.95;
  }
  
  return Math.round(price * 100) / 100;
}

// Translations
const t = {
  ua: {
    welcome: (name: string) => `Вітаємо, ${name}\nРаді, що ви з нами 🤍\n\nУ цьому боті ми зібрали все, щоб замовлення квітів було простим, швидким і приємним.\n\n🌸 Асортимент\n💰 Персональні ціни\n📦 Замовлення\n🎁 Бонуси\n\nОберіть будь-який пункт з меню та почнемо 🌿`,
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
    packaging: '🎀 Упакування',
    needPackaging: 'Чи потрібне упакування?',
    yes: '✅ Так',
    no: '❌ Ні',
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
    box: 'шт',
    available: '🟢 В наявності',
    preorderStatus: '🟡 Під замовлення',
    expected: '🔵 Очікується',
    height: 'Висота',
    color: 'Колір',
    class: 'Клас',
    price: 'Ціна',
    country: 'Країна',
    plantation: 'Плантація',
    managerContact: `📞 *Звʼяжіться з нашим менеджером:*\n\nМенеджер: +380 (68) 126 49 03\n\nTelegram: @manager\\_username\nViber: [Написати у Viber](https://surl.li/upwsxh)\nInstagram: [Наш Instagram](https://surl.li/mjfvsg)`,
    aboutText: `🌿 *KVITKA Opt — це про можливість бути іншими.*\n\nЗавдяки співпраці з різними плантаціями з усього світу ми відкриваємо флористам широкий вибір сортів, нових позицій і довготривалої квітки. Тієї, що не просто гарна, а справді довго радує.\n\nМи хочемо, щоб оптові закупівлі не забирали енергію, а навпаки — давали натхнення та впевненість у кожному замовленні.\n\n🌸 *Наші переваги:*\n▫️ Оптовий каталог квітів\n▫️ Формування заявок 24/7\n▫️ Понад 100 плантацій з усього світу\n▫️ Платформа для В2В клієнтів`,
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
    quantity: 'Кількість',
    referral: '👥 Реферальна програма',
    referralInfo: (code: string, balance: number, count: number, botUsername: string) => {
      return `👥 *Реферальна програма*\n\n🔗 Ваше посилання:\n\`https://t.me/${botUsername}?start=ref_${code}\`\n\n💰 Ваш баланс: ${balance} грн\n👥 Запрошено друзів: ${count}\n\n📌 *Як це працює:*\n• Поділіться посиланням з друзями\n• Коли друг зробить перше замовлення - ви отримаєте *200 грн* на баланс\n• Використовуйте баланс як знижку на наступне замовлення`;
    },
    referralBonus: '🎉 Вітаємо! Ви отримали 200 грн за запрошеного друга!',
    referralWelcome: (inviterName: string) => `🎁 Вас запросив ${inviterName}! Приємних покупок!`,
    menuButton: '🏠 Головне меню'
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
    packaging: '🎀 Packaging',
    needPackaging: 'Do you need packaging?',
    yes: '✅ Yes',
    no: '❌ No',
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
    box: 'pcs',
    available: '🟢 Available',
    preorderStatus: '🟡 Pre-order',
    expected: '🔵 Expected',
    height: 'Height',
    color: 'Color',
    class: 'Class',
    price: 'Price',
    country: 'Country',
    plantation: 'Plantation',
    managerContact: `📞 *Contact our manager:*\n\nManager: +380 (68) 126 49 03\n\nTelegram: @manager\\_username\nViber: [Write on Viber](https://surl.li/upwsxh)\nInstagram: [Our Instagram](https://surl.li/mjfvsg)`,
    aboutText: `🌿 *KVITKA Opt — it's about the opportunity to be different.*\n\nThanks to cooperation with various plantations around the world, we offer florists a wide selection of varieties, new positions and long-lasting flowers. Ones that are not just beautiful, but truly delight for a long time.\n\nWe want wholesale purchases to not take away energy, but on the contrary — to give inspiration and confidence in every order.\n\n🌸 *Our Advantages:*\n▫️ Wholesale flower catalog\n▫️ 24/7 order formation\n▫️ Over 100 plantations worldwide\n▫️ Platform for B2B clients`,
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
    quantity: 'Quantity',
    referral: '👥 Referral Program',
    referralInfo: (code: string, balance: number, count: number, botUsername: string) => {
      return `👥 *Referral Program*\n\n🔗 Your link:\n\`https://t.me/${botUsername}?start=ref_${code}\`\n\n💰 Your balance: ${balance} UAH\n👥 Friends invited: ${count}\n\n📌 *How it works:*\n• Share your link with friends\n• When a friend makes first order - you get *200 UAH* to balance\n• Use balance as discount on next order`;
    },
    referralBonus: '🎉 Congrats! You received 200 UAH for inviting a friend!',
    referralWelcome: (inviterName: string) => `🎁 You were invited by ${inviterName}! Enjoy shopping!`,
    menuButton: '🏠 Main Menu'
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
    packaging: '🎀 Упаковка',
    needPackaging: 'Нужна упаковка?',
    yes: '✅ Да',
    no: '❌ Нет',
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
    box: 'шт',
    available: '🟢 В наличии',
    preorderStatus: '🟡 Под заказ',
    expected: '🔵 Ожидается',
    height: 'Высота',
    color: 'Цвет',
    class: 'Класс',
    price: 'Цена',
    country: 'Страна',
    plantation: 'Плантация',
    managerContact: `📞 *Свяжитесь с нашим менеджером:*\n\nМенеджер: +380 (68) 126 49 03\n\nTelegram: @manager\\_username\nViber: [Написать в Viber](https://surl.li/upwsxh)\nInstagram: [Наш Instagram](https://surl.li/mjfvsg)`,
    aboutText: `🌿 *KVITKA Opt — это о возможности быть другими.*\n\nБлагодаря сотрудничеству с разными плантациями со всего мира мы открываем флористам широкий выбор сортов, новых позиций и долгоживущего цветка. Того, который не просто красив, а действительно долго радует.\n\nМы хотим, чтобы оптовые закупки не забирали энергию, а наоборот — давали вдохновение и уверенность в каждом заказе.\n\n🌸 *Наши преимущества:*\n▫️ Оптовый каталог цветов\n▫️ Формирование заявок 24/7\n▫️ Более 100 плантаций со всего мира\n▫️ Платформа для В2В клиентов`,
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
    quantity: 'Количество',
    referral: '👥 Реферальная программа',
    referralInfo: (code: string, balance: number, count: number, botUsername: string) => {
      return `👥 *Реферальная программа*\n\n🔗 Ваша ссылка:\n\`https://t.me/${botUsername}?start=ref_${code}\`\n\n💰 Ваш баланс: ${balance} грн\n👥 Приглашено друзей: ${count}\n\n📌 *Как это работает:*\n• Поделитесь ссылкой с друзьями\n• Когда друг сделает первый заказ - вы получите *200 грн* на баланс\n• Используйте баланс как скидку на следующий заказ`;
    },
    referralBonus: '🎉 Поздравляем! Вы получили 200 грн за приглашенного друга!',
    referralWelcome: (inviterName: string) => `🎁 Вас пригласил ${inviterName}! Приятных покупок!`,
    menuButton: '🏠 Главное меню'
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
async function showMainMenu(ctx: Context, session: UserSession, edit = false) {
  const txt = getText(session);
  const firstName = ctx.from?.first_name || 'User';
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(txt.catalog, 'catalog'), Markup.button.callback(txt.promotions, 'promotions')],
    [Markup.button.callback(txt.search, 'search'), Markup.button.callback(txt.packaging, 'packaging')],
    [Markup.button.callback(txt.favorites, 'favorites'), Markup.button.callback(txt.cart, 'cart')],
    [Markup.button.callback(txt.history, 'history'), Markup.button.callback(txt.loyalty, 'loyalty')],
    [Markup.button.callback(txt.referral, 'referral'), Markup.button.callback(txt.manager, 'manager')],
    [Markup.button.callback(txt.settings, 'settings'), Markup.button.callback(txt.about, 'about')]
  ]);

  // Delete current message first (the one with the button that was clicked)
  try { await ctx.deleteMessage(); } catch {}
  
  // Always clear previous messages before showing menu
  await clearOldMessages(ctx, session);
  
  // Set step to menu to ensure text messages don't trigger handlers
  session.step = 'menu';

  const welcomeMsg = await ctx.reply(txt.welcome(firstName), keyboard);
  registerMessage(session, welcomeMsg.message_id);
}

// Helper function to show filter menu
async function showFilterMenu(ctx: Context, session: UserSession) {
  const txt = getText(session);
  const catalogType = session.currentCatalogType || 'preorder';
  
  // Clear all previous messages first
  await clearOldMessages(ctx, session);
  
  // Try to delete the current message
  try {
    await ctx.deleteMessage();
  } catch {}
  
  // Validate session state - currentFarm is optional for instock
  if (!session.currentType || !session.currentCountry || (catalogType === 'preorder' && !session.currentFarm)) {
    const msg = await ctx.reply(
      '❌ Сесія застаріла. Почніть з початку.',
      Markup.inlineKeyboard([
        [Markup.button.callback('🌹 Каталог', 'catalog')],
        [Markup.button.callback('🏠 Меню', 'menu')]
      ])
    );
    registerMessage(session, msg.message_id);
    return;
  }
  
  // Get all products for this selection
  const products = await getCachedProducts();
  const baseProducts = products.filter(p => 
    p.typeId === session.currentType &&
    p.catalogType === catalogType &&
    (catalogType === 'instock' || p.plantationId === session.currentFarm) &&
    p.countryId === session.currentCountry
  );
  
  const currentFilters = session.filters || {};
  
  // Apply current filters to get filtered products
  let filteredProducts = [...baseProducts];
  if (currentFilters.flowerClass) {
    filteredProducts = filteredProducts.filter(p => p.flowerClass === currentFilters.flowerClass);
  }
  if (currentFilters.height) {
    // Height can be comma-separated, check if the selected height is in the product's heights
    filteredProducts = filteredProducts.filter(p => {
      const productHeights = String(p.height).split(',').map(h => h.trim());
      return productHeights.includes(currentFilters.height as string);
    });
  }
  if (currentFilters.color) {
    filteredProducts = filteredProducts.filter(p => {
      const productColors = String(p.color).split(',').map(c => c.trim());
      return productColors.includes(currentFilters.color as string);
    });
  }
  
  // Get available filter options from currently filtered products
  const classes = Array.from(new Set(baseProducts.map(p => p.flowerClass)));
  // Parse comma-separated heights and get unique values
  const allHeights: number[] = [];
  baseProducts.forEach(p => {
    String(p.height).split(',').forEach(h => {
      const parsed = parseInt(h.trim());
      if (!isNaN(parsed) && !allHeights.includes(parsed)) {
        allHeights.push(parsed);
      }
    });
  });
  const heights = allHeights.sort((a, b) => a - b);
  const allColors: string[] = [];
  baseProducts.forEach(p => {
    String(p.color).split(',').forEach(c => {
      const trimmed = c.trim();
      if (trimmed && !allColors.includes(trimmed)) {
        allColors.push(trimmed);
      }
    });
  });
  const colors = allColors.sort();
  
  let message = '🔍 *Фільтри:*\n\n';
  
  if (currentFilters.flowerClass) message += `✓ Клас: ${currentFilters.flowerClass}\n`;
  if (currentFilters.height) message += `✓ Висота: ${currentFilters.height} см\n`;
  if (currentFilters.color) message += `✓ Колір: ${currentFilters.color}\n`;
  
  message += `\n📦 Знайдено: ${filteredProducts.length} товарів`;
  
  const buttons: any[] = [];
  
  // Class filter
  if (classes.length > 1) {
    buttons.push([Markup.button.callback(
      currentFilters.flowerClass ? `✓ Клас: ${currentFilters.flowerClass}` : '📊 Клас', 
      'filter_class'
    )]);
  }
  
  // Height filter
  if (heights.length > 1) {
    buttons.push([Markup.button.callback(
      currentFilters.height ? `✓ Висота: ${currentFilters.height} см` : '📏 Висота', 
      'filter_height'
    )]);
  }
  
  // Color filter
  if (colors.length > 1) {
    buttons.push([Markup.button.callback(
      currentFilters.color ? `✓ Колір: ${currentFilters.color}` : '🎨 Колір', 
      'filter_color'
    )]);
  }
  
  // Clear filters if any are set
  if (currentFilters.flowerClass || currentFilters.height || currentFilters.color) {
    buttons.push([Markup.button.callback('🔄 Скинути фільтри', 'clear_filters')]);
  }
  
  // Safe back navigation
  if (catalogType === 'instock') {
    buttons.push([Markup.button.callback('◀️ До типів', `country_instock_${session.currentCountry}`)]);
  } else {
    buttons.push([Markup.button.callback('◀️ До ферм', `country_preorder_${session.currentCountry}`)]);
  }
  buttons.push([Markup.button.callback('🏠 Меню', 'menu')]);
  
  // If there are filter options available, show products first, then filter menu at the bottom
  const hasFilterOptions = classes.length > 1 || heights.length > 1 || colors.length > 1;
  
  if (hasFilterOptions) {
    // Show products first
    for (const product of filteredProducts) {
      await sendProductCard(ctx, product, session);
    }
    
    // Show filter menu at the bottom after products
    const filterMsg = await ctx.reply(message, { 
      parse_mode: 'Markdown', 
      ...Markup.inlineKeyboard(buttons) 
    });
    registerMessage(session, filterMsg.message_id);
  } else {
    // No filter options - just show products directly
    for (const product of filteredProducts) {
      await sendProductCard(ctx, product, session);
    }
    
    // Show simple navigation at the bottom
    const navButtons = [];
    if (catalogType === 'instock') {
      navButtons.push([Markup.button.callback('◀️ До типів', `country_instock_${session.currentCountry}`)]);
    } else {
      navButtons.push([Markup.button.callback('◀️ До ферм', `country_preorder_${session.currentCountry}`)]);
    }
    navButtons.push([Markup.button.callback('🏠 Меню', 'menu')]);
    
    const navMsg = await ctx.reply('📦 Навігація:', Markup.inlineKeyboard(navButtons));
    registerMessage(session, navMsg.message_id);
  }
}

// Helper function to send product card
async function sendProductCard(ctx: Context, product: Product, session: UserSession, isPromo = false) {
  const txt = getText(session);
  const price = await calculatePriceAsync(product, session);
  
  // Short product ID for callbacks (first 8 chars of UUID)
  const shortId = product.id.substring(0, 8);
  
  // Check promo status
  const promoPercent = (product as any).promoPercent || 0;
  const promoEndDate = (product as any).promoEndDate;
  const isPromoActive = product.isPromo && promoPercent > 0 && 
    (!promoEndDate || new Date(promoEndDate) > new Date());
  
  // Check if this is a packaging product
  const isPackaging = (product as any).flowerType?.category === 'packaging' ||
    product.name.toLowerCase().includes('упакування') ||
    product.name.toLowerCase().includes('плівка') ||
    product.name.toLowerCase().includes('папір') ||
    product.name.toLowerCase().includes('стрічка') ||
    product.name.toLowerCase().includes('коробка') ||
    product.name.toLowerCase().includes('сітка');
  
  const heightPricesStr = (product as any).heightPrices;
  const hasHeightPrices = !!(heightPricesStr && product.catalogType === 'preorder');
  
  // Build beautiful product card - clean and simple
  let message = '';
  if (isPromo || isPromoActive) {
    message += `🔥 *АКЦІЯ -${promoPercent}%!*\n`;
  }
  message += `*${product.name}*\n`;
  
  // For packaging - only show name and price
  if (isPackaging) {
    message += `\n💰 *${price.toLocaleString('uk-UA')} грн*`;
  } else {
    message += `_${product.variety}_\n\n`;
    message += `├ ${txt.class}: ${product.flowerClass}\n`;
    
    if (!hasHeightPrices && product.height && product.height !== '0') {
      message += `├ ${txt.height}: ${product.height} см\n`;
    }
    message += `└ ${txt.color}: ${product.color}\n\n`;
    
    // Check if multi-height pricing is available
    if (heightPricesStr && product.catalogType === 'preorder') {
      // Parse heightPrices format: "60:1.20, 70:2.20" - prices in USD, convert to UAH
      const rateSetting = await storage.getSetting('usd_to_uah_rate');
      const rate = parseFloat(rateSetting?.value || '41.5');
      const parts = heightPricesStr.split(',').map((p: string) => p.trim());
      message += `💰 *Оберіть висоту:*\n`;
      for (const part of parts) {
        const [h, p] = part.split(':');
        if (h && p) {
          const usdPrice = parseFloat(p.trim());
          const uahPrice = Math.round(usdPrice * rate);
          message += `   ${h.trim()} см - ${uahPrice.toLocaleString('uk-UA')} грн\n`;
        }
      }
      message += `_(ціна за шт)_`;
    } else {
      // Only show UAH price
      message += `💰 *${price.toLocaleString('uk-UA')} грн* _(ціна за шт)_`;
    }
  }
  
  // Show promo timer if end date is set
  if (isPromoActive && promoEndDate) {
    const endDate = new Date(promoEndDate);
    const now = new Date();
    const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0 && diffDays <= 7) {
      message += `\n⏰ _Акція закінчується через ${diffDays} дн._`;
    }
  }
  
  if (session.customerType === 'wholesale') {
    message += `\n🏷️ _Ваша знижка: -5%_`;
  }
  
  // Check if multi-height pricing - show height selection buttons
  const hasMultiHeight = hasHeightPrices;
  
  let buttonRows: any[] = [];
  
  if (hasMultiHeight) {
    // Parse heights and create selection buttons
    const rateSetting = await storage.getSetting('usd_to_uah_rate');
    const rate = parseFloat(rateSetting?.value || '41.5');
    const parts = heightPricesStr.split(',').map((p: string) => p.trim());
    const heightButtons: any[] = [];
    
    for (const part of parts) {
      const [h, p] = part.split(':');
      if (h && p) {
        const height = h.trim();
        const usdPrice = parseFloat(p.trim());
        const uahPrice = Math.round(usdPrice * rate);
        heightButtons.push(
          Markup.button.callback(`${height} см - ${uahPrice} грн`, `h_${height}_${shortId}`)
        );
      }
    }
    
    // Split height buttons into rows of 2
    for (let i = 0; i < heightButtons.length; i += 2) {
      buttonRows.push(heightButtons.slice(i, i + 2));
    }
  } else {
    // Regular quantity buttons
    const qtyButtons = isPackaging 
      ? [
          Markup.button.callback('+1 шт', `c_1_${shortId}`),
          Markup.button.callback('+5 шт', `c_5_${shortId}`),
          Markup.button.callback('+25 шт', `c_25_${shortId}`)
        ]
      : [
          Markup.button.callback('+25 шт', `c_25_${shortId}`),
          Markup.button.callback('+50 шт', `c_50_${shortId}`),
          Markup.button.callback('+100 шт', `c_100_${shortId}`)
        ];
    buttonRows.push(qtyButtons);
  }
  
  // Add favorites and cart buttons
  buttonRows.push([
    Markup.button.callback(session.favorites.includes(product.id) ? '❤️ В обраному' : '🤍 В обране', `f_${shortId}`),
    Markup.button.callback('🧺 Кошик', 'cart')
  ]);
  buttonRows.push([Markup.button.callback('🏠 Меню', 'menu')]);
  
  const buttons = Markup.inlineKeyboard(buttonRows);
  
  // Send photos as media group if multiple, or single photo
  if (product.images && product.images.length > 0) {
    try {
      const baseUrl = process.env.BASE_URL || 
                      (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null);
      
      // Helper to get image source
      const getImageSource = (imagePath: string) => {
        if (imagePath.startsWith('/uploads/') && baseUrl) {
          return `${baseUrl}${imagePath}`;
        }
        if (imagePath.startsWith('/uploads/')) {
          const relativePath = imagePath.slice(1);
          const fullPath = path.resolve(process.cwd(), relativePath);
          if (fs.existsSync(fullPath)) {
            return { source: fullPath };
          }
        }
        if (imagePath.startsWith('attached_assets/') || imagePath.startsWith('./')) {
          const fullPath = path.resolve(process.cwd(), imagePath);
          if (fs.existsSync(fullPath)) {
            return { source: fullPath };
          }
        }
        return imagePath; // URL
      };
      
      // Filter valid images - check availability for Railway
      const validImages: string[] = [];
      for (const img of product.images) {
        if (img.startsWith('/uploads/')) {
          const relativePath = img.slice(1);
          const fullPath = path.resolve(process.cwd(), relativePath);
          if (fs.existsSync(fullPath)) {
            validImages.push(img);
          } else if (baseUrl) {
            // On Railway - check if URL is accessible
            const url = `${baseUrl}${img}`;
            if (await isUrlAccessible(url)) {
              validImages.push(img);
            }
          }
        } else {
          // External URL - assume OK
          validImages.push(img);
        }
      }
      
      // If multiple images - send as media group
      if (validImages.length > 1) {
        const mediaGroup = validImages.slice(0, 10).map((img, idx) => ({
          type: 'photo' as const,
          media: getImageSource(img) as any,
          caption: idx === 0 ? message : undefined,
          parse_mode: idx === 0 ? 'Markdown' as const : undefined
        }));
        
        try {
          const msgs = await ctx.replyWithMediaGroup(mediaGroup);
          msgs.forEach(m => registerMessage(session, m.message_id));
          
          // Send buttons separately after media group
          const btnMsg = await ctx.reply('Оберіть дію:', buttons);
          registerMessage(session, btnMsg.message_id);
          return;
        } catch (mediaErr) {
          // If media group fails, try single image or text
          console.error('Media group failed, trying single image:', mediaErr);
        }
      }
      
      // Single image (or fallback from failed media group)
      if (validImages.length >= 1) {
        const imageSource = getImageSource(validImages[0]);
        try {
          const msg = await ctx.replyWithPhoto(imageSource as any, {
            caption: message,
            parse_mode: 'Markdown',
            reply_markup: buttons.reply_markup
          });
          registerMessage(session, msg.message_id);
          return;
        } catch (photoErr) {
          console.error('Single photo failed, sending text only:', photoErr);
        }
      }
      
      // Fallback to text only
      const msg = await ctx.reply(message, { parse_mode: 'Markdown', ...buttons });
      registerMessage(session, msg.message_id);
      return;
    } catch (err) {
      console.error('Failed to send photo:', err);
      const msg = await ctx.reply(message, { parse_mode: 'Markdown', ...buttons });
      registerMessage(session, msg.message_id);
    }
  } else {
    const msg = await ctx.reply(message, { parse_mode: 'Markdown', ...buttons });
    registerMessage(session, msg.message_id);
  }
}

if (bot) {
  // Start command - go directly to menu without onboarding
  bot.start(async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const telegramUsername = ctx.from?.username || '';
    const session = getSession(telegramId);
    
    // Check for referral code in start payload
    const startPayload = (ctx.message as any)?.text?.split(' ')[1] || '';
    const referralCode = startPayload.startsWith('ref_') ? startPayload.substring(4) : null;
    
    // Detect language from Telegram locale (default to 'ua')
    const telegramLang = ctx.from?.language_code;
    let detectedLang: 'ua' | 'en' | 'ru' = 'ua';
    if (telegramLang === 'en') detectedLang = 'en';
    else if (telegramLang === 'ru') detectedLang = 'ru';
    else if (telegramLang === 'uk') detectedLang = 'ua';
    
    try {
      // Check if customer already exists in database
      const customers = await storage.getCustomers();
      let existingCustomer = customers.find(c => c.telegramId === telegramId);
      let referrerName: string | null = null;
      
      if (existingCustomer) {
        // Restore session from customer data
        session.language = (existingCustomer.language as 'ua' | 'en' | 'ru') || 'ua';
        session.city = existingCustomer.city || '';
        session.customerType = (existingCustomer.customerType as 'flower_shop' | 'wholesale') || 'flower_shop';
      } else {
        // New user - check if they came from a referral link
        let referredById: string | undefined;
        if (referralCode) {
          const referrer = await storage.getCustomerByReferralCode(referralCode);
          if (referrer && referrer.telegramId !== telegramId) {
            referredById = referrer.id;
            referrerName = referrer.name;
          }
        }
        
        // New user - create customer with detected language (no onboarding)
        session.language = detectedLang;
        session.customerType = 'flower_shop';
        session.city = '';
        
        existingCustomer = await storage.createCustomer({
          telegramId,
          telegramUsername,
          name: ctx.from?.first_name || 'Telegram User',
          phone: '',
          shopName: '',
          city: '',
          customerType: 'flower_shop',
          language: detectedLang,
          isBlocked: false,
          referredBy: referredById
        });
      }
      
      session.step = 'menu';
      
      // Show referral welcome message if applicable
      const txt = getText(session);
      if (referrerName) {
        await ctx.reply(txt.referralWelcome(referrerName));
      }
      
      // Go directly to main menu with welcome message
      await showMainMenu(ctx, session);
    } catch (error) {
      console.error('Error in /start:', error);
      // Show menu anyway with defaults
      session.language = detectedLang;
      session.customerType = 'flower_shop';
      session.step = 'menu';
      await showMainMenu(ctx, session);
    }
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
      
      // Delete user's input message and clear old messages
      try { await ctx.deleteMessage(); } catch {}
      await clearOldMessages(ctx, session);
      
      const msg = await ctx.reply(
        '📞 Введіть ваш *номер телефону*:',
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Скасувати', 'cart')]
        ])}
      );
      registerMessage(session, msg.message_id);
    } else if (session.step === 'checkout_phone') {
      // Collect phone
      session.checkoutData = session.checkoutData || {};
      session.checkoutData.phone = ctx.message.text;
      session.step = 'checkout_address';
      
      // Delete user's input message and clear old messages
      try { await ctx.deleteMessage(); } catch {}
      await clearOldMessages(ctx, session);
      
      const msg = await ctx.reply(
        '📍 Введіть *адресу доставки*:',
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Скасувати', 'cart')]
        ])}
      );
      registerMessage(session, msg.message_id);
    } else if (session.step === 'checkout_address') {
      // Collect address and ask about packaging
      session.checkoutData = session.checkoutData || {};
      session.checkoutData.address = ctx.message.text;
      session.step = 'checkout_packaging';
      
      // Delete user's input message and clear old messages
      try { await ctx.deleteMessage(); } catch {}
      await clearOldMessages(ctx, session);
      
      const msg = await ctx.reply(
        '🎀 *Чи потрібна вам упаковка?*',
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Так', 'packaging_yes'), Markup.button.callback('❌ Ні', 'packaging_no')],
          [Markup.button.callback('❌ Скасувати', 'cart')]
        ])}
      );
      registerMessage(session, msg.message_id);
    } else if ((session as any).awaitingSearch || session.step === 'search') {
      // Search functionality
      const searchTerm = ctx.message.text.toLowerCase();
      const products = await getCachedProducts();
      
      // Search for products by name and variety
      const found = products.filter(p => {
        // Exclude packaging from search
        const isPackaging = (p as any).flowerType?.category === 'packaging' ||
          p.name.toLowerCase().includes('упакування') ||
          p.name.toLowerCase().includes('плівка') ||
          p.name.toLowerCase().includes('папір');
        if (isPackaging) return false;
        
        const name = (p.name || '').toLowerCase();
        const variety = (p.variety || '').toLowerCase();
        return name.includes(searchTerm) || variety.includes(searchTerm);
      });
      
      // Clear search flag and reset step
      (session as any).awaitingSearch = false;
      session.step = 'menu';
      
      // Delete user's text message
      try { await ctx.deleteMessage(); } catch {}
      
      if (found.length === 0) {
        await ctx.reply(
          txt.noProducts + '\n\nСпробуйте інший пошуковий запит.',
          Markup.inlineKeyboard([
            [Markup.button.callback('🔍 Пошук', 'search')],
            [Markup.button.callback('🏠 Меню', 'menu')]
          ])
        );
      } else {
        for (const product of found.slice(0, 10)) {
          await sendProductCard(ctx, product, session);
        }
        
        const summaryMsg = await ctx.reply(`📊 Знайдено товарів: ${found.length}`, Markup.inlineKeyboard([
          [Markup.button.callback('🔍 Шукати ще', 'search')],
          [Markup.button.callback('🏠 Меню', 'menu')]
        ]));
        session.messagesToDelete.push(summaryMsg.message_id);
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
    await showMainMenu(ctx, session, true);
  });

  // Main menu
  bot.action('menu', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    session.step = 'menu';
    await ctx.answerCbQuery();
    await showMainMenu(ctx, session, true);
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
        [Markup.button.callback('🏠 Меню', 'menu')]
      ])
    );
  });

  // Catalog sections - show only countries that have products
  bot.action(/^catalog_(preorder|instock)$/, async (ctx) => {
    const catalogType = ctx.match[1];
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    // Get products for this catalog type
    const products = await getCachedProducts();
    const catalogProducts = products.filter(p => p.catalogType === catalogType);
    
    // Get unique country IDs that have products
    const countryIdsWithProducts = Array.from(new Set(catalogProducts.map(p => p.countryId)));
    
    const allCountries = await storage.getCountries();
    const countriesWithProducts = allCountries.filter(c => countryIdsWithProducts.includes(c.id));
    
    if (countriesWithProducts.length === 0) {
      await ctx.editMessageText(
        `❌ Немає товарів у розділі "${catalogType === 'preorder' ? 'Передзамовлення' : 'В наявності'}"`,
        Markup.inlineKeyboard([
          [Markup.button.callback(txt.back, 'catalog')],
          [Markup.button.callback('🏠 Меню', 'menu')]
        ])
      );
      return;
    }
    
    const buttons = countriesWithProducts.map(c => [
      Markup.button.callback(`${countryFlags[c.code] || ''} ${c.name}`, `country_${catalogType}_${c.id}`)
    ]);
    buttons.push([Markup.button.callback(txt.back, 'catalog')]);
    buttons.push([Markup.button.callback('🏠 Меню', 'menu')]);
    
    await ctx.editMessageText(
      `${txt.country}:`,
      Markup.inlineKeyboard(buttons)
    );
  });

  // Country selection - show farms/plantations from this country
  bot.action(/^country_(.+)_(.+)$/, async (ctx) => {
    const [catalogType, countryId] = [ctx.match[1], ctx.match[2]];
    const session = getSession(ctx.from!.id.toString());
    session.currentCountry = countryId;
    session.currentCatalogType = catalogType as 'preorder' | 'instock';
    session.filters = {}; // Reset filters
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    // Get products for this country and catalog type
    const products = await getCachedProducts();
    const countryProducts = products.filter(p => 
      p.countryId === countryId && 
      p.catalogType === catalogType
    );

    // For instock, we skip farms and go to flower types
    if (catalogType === 'instock') {
      const typeIdsWithProducts = Array.from(new Set(
        countryProducts.map(p => p.typeId)
      ));
      
      const allTypes = await storage.getFlowerTypes();
      const typesWithProducts = allTypes.filter(t => typeIdsWithProducts.includes(t.id));
      
      if (typesWithProducts.length === 0) {
        await ctx.editMessageText(
          '❌ В цій країні немає товарів в наявності',
          Markup.inlineKeyboard([
            [Markup.button.callback(txt.back, 'catalog_instock')],
            [Markup.button.callback('🏠 Меню', 'menu')]
          ])
        );
        return;
      }

      const typeButtons = typesWithProducts.map(t => [
        Markup.button.callback(`🌸 ${t.name}`, `ftype_${t.id.substring(0, 12)}`)
      ]);
      
      typeButtons.push([Markup.button.callback(txt.back, 'catalog_instock')]);
      typeButtons.push([Markup.button.callback('🏠 Меню', 'menu')]);
      
      const allCountries = await storage.getCountries();
      const country = allCountries.find(c => c.id === countryId);

      await ctx.editMessageText(
        `🌹 *Оберіть тип квітів (${country?.flag || ''} ${country?.name || ''})*`,
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard(typeButtons) }
      );
      return;
    }

    // Get unique farm/plantation IDs that have products
    const farmIdsWithProducts = Array.from(new Set(countryProducts.map(p => p.plantationId).filter(Boolean)));
    
    // Get all plantations and filter to those with products
    const allPlantations = await storage.getPlantations();
    const farmsWithProducts = allPlantations.filter(f => farmIdsWithProducts.includes(f.id));
    
    if (farmsWithProducts.length === 0) {
      await ctx.editMessageText(
        '❌ В цій країні немає ферм з товарами',
        Markup.inlineKeyboard([
          [Markup.button.callback(txt.back, `catalog_${catalogType}`)],
          [Markup.button.callback('🏠 Меню', 'menu')]
        ])
      );
      return;
    }
    
    const buttons = farmsWithProducts.map(f => [
      Markup.button.callback(`🏡 ${f.name}`, `farm_${f.id.substring(0, 12)}`)
    ]);
    buttons.push([Markup.button.callback(txt.back, `catalog_${catalogType}`)]);
    buttons.push([Markup.button.callback('🏠 Меню', 'menu')]);
    
    await ctx.editMessageText(
      `🏡 *Оберіть ферму:*`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
    );
  });

  // Farm selection - show flower types from this farm
  bot.action(/^farm_(.+)$/, async (ctx) => {
    const farmPart = ctx.match[1];
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    // Find full farm ID
    const allPlantations = await storage.getPlantations();
    const farm = allPlantations.find(f => f.id.startsWith(farmPart));
    if (!farm) {
      await ctx.answerCbQuery('Ферму не знайдено');
      return;
    }
    
    session.currentFarm = farm.id;
    const catalogType = session.currentCatalogType || 'preorder';
    
    // Get products for this farm and catalog type
    const products = await getCachedProducts();
    const farmProducts = products.filter(p => 
      p.plantationId === farm.id && 
      p.catalogType === catalogType
    );
    
    // Get unique flower type IDs
    const typeIdsWithProducts = Array.from(new Set(farmProducts.map(p => p.typeId)));
    
    const allTypes = await storage.getFlowerTypes();
    const typesWithProducts = allTypes.filter(t => typeIdsWithProducts.includes(t.id));
    
    if (typesWithProducts.length === 0) {
      await ctx.editMessageText(
        '❌ На цій фермі немає товарів',
        Markup.inlineKeyboard([
          [Markup.button.callback(txt.back, `country_${catalogType}_${session.currentCountry}`)],
          [Markup.button.callback('🏠 Меню', 'menu')]
        ])
      );
      return;
    }
    
    const buttons = typesWithProducts.map(t => [
      Markup.button.callback(`🌸 ${t.name}`, `ftype_${t.id.substring(0, 12)}`)
    ]);
    buttons.push([Markup.button.callback(txt.back, `country_${catalogType}_${session.currentCountry}`)]);
    buttons.push([Markup.button.callback('🏠 Меню', 'menu')]);
    
    await ctx.editMessageText(
      `🌸 *Оберіть тип квітів:*\n\n🏡 Ферма: ${farm.name}`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
    );
  });

  // Flower type selection from farm - show filter options
  bot.action(/^ftype_(.+)$/, async (ctx) => {
    const typePart = ctx.match[1];
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    const allTypes = await storage.getFlowerTypes();
    const flowerType = allTypes.find(t => t.id.startsWith(typePart));
    if (!flowerType) {
      await ctx.answerCbQuery('Тип не знайдено');
      return;
    }
    
    session.currentType = flowerType.id;
    session.filters = {};
    
    // Show filter menu
    await showFilterMenu(ctx, session);
  });

  // Filter handlers
  bot.action('filter_class', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const catalogType = session.currentCatalogType || 'preorder';
    await ctx.answerCbQuery();
    
    const products = await getCachedProducts();
    const filtered = products.filter(p => 
      (catalogType === 'instock' || p.plantationId === session.currentFarm) &&
      p.typeId === session.currentType &&
      p.catalogType === catalogType
    );
    
    const classes = Array.from(new Set(filtered.map(p => p.flowerClass)));
    
    const buttons = classes.map(c => [
      Markup.button.callback(c, `set_class_${c}`)
    ]);
    buttons.push([Markup.button.callback('◀️ Назад', 'back_to_filters')]);
    
    await ctx.editMessageText(
      '📊 *Оберіть клас:*',
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
    );
  });

  bot.action(/^set_class_(.+)$/, async (ctx) => {
    const flowerClass = ctx.match[1];
    const session = getSession(ctx.from!.id.toString());
    session.filters = session.filters || {};
    session.filters.flowerClass = flowerClass;
    await ctx.answerCbQuery(`Обрано: ${flowerClass}`);
    await showFilterMenu(ctx, session);
  });

  bot.action('filter_height', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const catalogType = session.currentCatalogType || 'preorder';
    await ctx.answerCbQuery();
    
    const products = await getCachedProducts();
    const filtered = products.filter(p => 
      (catalogType === 'instock' || p.plantationId === session.currentFarm) &&
      p.typeId === session.currentType &&
      p.catalogType === catalogType
    );
    
    // Parse comma-separated heights and collect unique values with min prices
    const heightPrices: Map<number, number> = new Map();
    filtered.forEach(p => {
      const priceUsd = parseFloat(p.priceUsd?.toString() || '0');
      String(p.height).split(',').forEach(h => {
        const parsed = parseInt(h.trim());
        if (!isNaN(parsed)) {
          const currentMin = heightPrices.get(parsed);
          if (currentMin === undefined || priceUsd < currentMin) {
            heightPrices.set(parsed, priceUsd);
          }
        }
      });
    });
    
    const heights = Array.from(heightPrices.keys()).sort((a, b) => a - b);
    
    // Show only heights without prices in filter
    const buttons = heights.map(h => {
      return [Markup.button.callback(`${h} см`, `set_height_${h}`)];
    });
    buttons.push([Markup.button.callback('◀️ Назад', 'back_to_filters')]);
    
    await ctx.editMessageText(
      '📏 *Оберіть висоту:*',
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
    );
  });

  bot.action(/^set_height_(\d+)$/, async (ctx) => {
    const height = ctx.match[1];
    const session = getSession(ctx.from!.id.toString());
    session.filters = session.filters || {};
    session.filters.height = height;
    await ctx.answerCbQuery(`Обрано: ${height} см`);
    await showFilterMenu(ctx, session);
  });

  bot.action('filter_color', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const catalogType = session.currentCatalogType || 'preorder';
    await ctx.answerCbQuery();
    
    const products = await getCachedProducts();
    const filtered = products.filter(p => 
      (catalogType === 'instock' || p.plantationId === session.currentFarm) &&
      p.typeId === session.currentType &&
      p.catalogType === catalogType
    );
    
    const allColors = new Set<string>();
    filtered.forEach(p => {
      String(p.color).split(',').forEach(c => {
        const trimmed = c.trim();
        if (trimmed) allColors.add(trimmed);
      });
    });
    const colors = Array.from(allColors).sort();
    
    const buttons = colors.map(c => [
      Markup.button.callback(c, `set_color_${c}`)
    ]);
    buttons.push([Markup.button.callback('◀️ Назад', 'back_to_filters')]);
    
    await ctx.editMessageText(
      '🎨 *Оберіть колір:*',
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
    );
  });

  bot.action(/^set_color_(.+)$/, async (ctx) => {
    const color = ctx.match[1];
    const session = getSession(ctx.from!.id.toString());
    session.filters = session.filters || {};
    session.filters.color = color;
    await ctx.answerCbQuery(`Обрано: ${color}`);
    await showFilterMenu(ctx, session);
  });

  bot.action('clear_filters', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    session.filters = {};
    await ctx.answerCbQuery('Фільтри скинуто');
    await showFilterMenu(ctx, session);
  });

  bot.action('back_to_filters', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    await ctx.answerCbQuery();
    await showFilterMenu(ctx, session);
  });

  // Show filtered products
  bot.action('show_filtered_products', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    const catalogType = session.currentCatalogType || 'preorder';
    await ctx.answerCbQuery();
    
    const products = await getCachedProducts();
    let filtered = products.filter(p => {
      // For "instock" - don't check plantationId (it's null)
      if (catalogType === 'instock') {
        return p.typeId === session.currentType && p.catalogType === catalogType;
      } else {
        // For "preorder" - check plantationId
        return p.plantationId === session.currentFarm &&
               p.typeId === session.currentType &&
               p.catalogType === catalogType;
      }
    });
    
    // Apply filters
    const filters = session.filters || {};
    if (filters.flowerClass) {
      filtered = filtered.filter(p => p.flowerClass === filters.flowerClass);
    }
    if (filters.height) {
      // Height can be comma-separated, check if the selected height is in the product's heights
      filtered = filtered.filter(p => {
        const productHeights = String(p.height).split(',').map(h => h.trim());
        return productHeights.includes(filters.height as string);
      });
    }
    if (filters.color) {
      filtered = filtered.filter(p => {
        const productColors = String(p.color).split(',').map(c => c.trim());
        return productColors.includes(filters.color as string);
      });
    }
    
    if (filtered.length === 0) {
      await ctx.editMessageText(
        txt.noProducts,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Змінити фільтри', 'back_to_filters')],
          [Markup.button.callback('🏠 Меню', 'menu')]
        ])
      );
      return;
    }
    
    // Delete the filter message and send product cards
    try { await ctx.deleteMessage(); } catch {}
    for (const product of filtered.slice(0, 10)) {
      await sendProductCard(ctx, product, session);
    }
    
    if (filtered.length > 10) {
      await ctx.reply(`Показано 10 з ${filtered.length} товарів`);
    }
  });

  // Keep old handler for backwards compatibility with direct catalog selection
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
      await ctx.editMessageText(
        txt.noProducts,
        Markup.inlineKeyboard([
          [Markup.button.callback(txt.back, `country_${catalogType}_${session.currentCountry}`)],
          [Markup.button.callback('🏠 Меню', 'menu')]
        ])
      );
      return;
    }
    
    // Delete the category message and send product cards
    try { await ctx.deleteMessage(); } catch {}
    for (const product of filtered.slice(0, 5)) {
      await sendProductCard(ctx, product, session);
    }
  });

  // Height selection for multi-height products (h_<height>_<shortId>)
  bot.action(/^h_(\d+)_(.+)$/, async (ctx) => {
    const selectedHeight = ctx.match[1];
    const shortId = ctx.match[2];
    const session = getSession(ctx.from!.id.toString());
    
    // Find product
    const products = await getCachedProducts();
    const product = products.find(p => p.id.startsWith(shortId));
    
    if (!product) {
      await ctx.answerCbQuery('Товар не знайдено');
      return;
    }
    
    // Store selected height in session for this product
    if (!session.selectedHeights) {
      (session as any).selectedHeights = {};
    }
    (session as any).selectedHeights[product.id] = selectedHeight;
    
    // Get price for this height
    const heightPricesStr = (product as any).heightPrices;
    const rateSetting = await storage.getSetting('usd_to_uah_rate');
    const rate = parseFloat(rateSetting?.value || '41.5');
    
    let heightPrice = 0;
    const parts = heightPricesStr.split(',').map((p: string) => p.trim());
    for (const part of parts) {
      const [h, p] = part.split(':');
      if (h && h.trim() === selectedHeight && p) {
        heightPrice = Math.round(parseFloat(p.trim()) * rate);
        break;
      }
    }
    
    await ctx.answerCbQuery(`Обрано ${selectedHeight} см - ${heightPrice} грн`);
    
    // Update message with quantity buttons for this height
    const qtyButtons = [
      Markup.button.callback('+25 шт', `ch_25_${selectedHeight}_${shortId}`),
      Markup.button.callback('+50 шт', `ch_50_${selectedHeight}_${shortId}`),
      Markup.button.callback('+100 шт', `ch_100_${selectedHeight}_${shortId}`)
    ];
    
    const buttons = Markup.inlineKeyboard([
      [Markup.button.callback(`📏 Висота: ${selectedHeight} см - ${heightPrice} грн/шт`, `p_${shortId}`)],
      qtyButtons,
      [
        Markup.button.callback(session.favorites.includes(product.id) ? '❤️ В обраному' : '🤍 В обране', `f_${shortId}`),
        Markup.button.callback('🧺 Кошик', 'cart')
      ],
      [Markup.button.callback('🏠 Меню', 'menu')]
    ]);
    
    try {
      await ctx.editMessageReplyMarkup(buttons.reply_markup);
    } catch (e) {
      // Ignore if message couldn't be edited
    }
  });

  // Add to cart with specific height (ch_<qty>_<height>_<shortId>)
  bot.action(/^ch_(\d+)_(\d+)_(.+)$/, async (ctx) => {
    const quantity = parseInt(ctx.match[1]);
    const height = ctx.match[2];
    const shortId = ctx.match[3];
    const session = getSession(ctx.from!.id.toString());
    
    // Find product
    const products = await getCachedProducts();
    const product = products.find(p => p.id.startsWith(shortId));
    
    if (!product) {
      await ctx.answerCbQuery('Товар не знайдено');
      return;
    }
    
    // Create cart item key with height
    const cartKey = `${product.id}_h${height}`;
    const existing = session.cart.find(c => c.productId === cartKey);
    if (existing) {
      existing.quantity += quantity;
    } else {
      session.cart.push({ productId: cartKey, quantity });
    }
    
    const totalInCart = session.cart.reduce((sum, item) => sum + item.quantity, 0);
    await ctx.answerCbQuery(`✅ Додано ${quantity} шт (${height} см). Всього: ${totalInCart} у кошику`);
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
    await ctx.answerCbQuery(`✅ Додано ${quantity} шт. Всього: ${totalInCart} у кошику`);
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
    
    // Check if this is a packaging product
    const isPackaging = (product as any).flowerType?.category === 'packaging' ||
      product.name.toLowerCase().includes('упакування') ||
      product.name.toLowerCase().includes('плівка') ||
      product.name.toLowerCase().includes('папір') ||
      product.name.toLowerCase().includes('стрічка') ||
      product.name.toLowerCase().includes('коробка') ||
      product.name.toLowerCase().includes('сітка');
    
    // Different quantity buttons for packaging vs flowers
    const qtyButtons = isPackaging 
      ? [
          Markup.button.callback('+1 шт', `c_1_${shortId}`),
          Markup.button.callback('+5 шт', `c_5_${shortId}`),
          Markup.button.callback('+25 шт', `c_25_${shortId}`)
        ]
      : [
          Markup.button.callback('+25 шт', `c_25_${shortId}`),
          Markup.button.callback('+50 шт', `c_50_${shortId}`),
          Markup.button.callback('+100 шт', `c_100_${shortId}`)
        ];
    
    // Update the message with new button state
    const buttons = Markup.inlineKeyboard([
      qtyButtons,
      [
        Markup.button.callback(session.favorites.includes(product.id) ? '❤️ В обраному' : '🤍 В обране', `f_${shortId}`),
        Markup.button.callback('🧺 Кошик', 'cart')
      ],
      [
        Markup.button.callback('🏠 Меню', 'menu')
      ]
    ]);
    
    try {
      await ctx.editMessageReplyMarkup(buttons.reply_markup);
    } catch (e) {
      // Ignore if message couldn't be edited (e.g. same markup)
    }
  });

  // Favorites
  bot.action('favorites', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    if (session.favorites.length === 0) {
      await ctx.editMessageText(txt.noFavorites, Markup.inlineKeyboard([
        [Markup.button.callback('🌹 Каталог', 'catalog')],
        [Markup.button.callback('🏠 Меню', 'menu')]
      ]));
      return;
    }
    
    // Clear old messages before sending product cards
    try { await ctx.deleteMessage(); } catch {}
    await clearOldMessages(ctx, session);
    
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
    
    // Clear all previous messages for clean cart view
    await clearOldMessages(ctx, session);
    
    if (session.cart.length === 0) {
      const msg = await ctx.reply(
        '🧺 *Ваш кошик порожній*\n\nДодайте товари з каталогу!',
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🌹 Каталог', 'catalog')],
            [Markup.button.callback('🏠 Меню', 'menu')]
          ])
        }
      );
      registerMessage(session, msg.message_id);
      return;
    }
    
    // Clear old messages before showing cart
    try { await ctx.deleteMessage(); } catch {}
    await clearOldMessages(ctx, session);
    
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
      // Check if item has height suffix (format: productId_h60)
      let productId = item.productId;
      let heightSuffix = '';
      if (item.productId.includes('_h')) {
        const parts = item.productId.split('_h');
        productId = parts[0];
        heightSuffix = parts[1];
      }
      
      const product = products.find(p => p.id === productId);
      if (product) {
        let price: number;
        
        // If height suffix exists, calculate price from heightPrices
        if (heightSuffix && (product as any).heightPrices) {
          const rateSetting = await storage.getSetting('usd_to_uah_rate');
          const rate = parseFloat(rateSetting?.value || '41.5');
          const heightPricesStr = (product as any).heightPrices;
          const priceParts = heightPricesStr.split(',').map((p: string) => p.trim());
          price = 0;
          for (const part of priceParts) {
            const [h, p] = part.split(':');
            if (h && h.trim() === heightSuffix && p) {
              price = Math.round(parseFloat(p.trim()) * rate);
              break;
            }
          }
          // Apply wholesale discount if applicable
          if (session.customerType === 'wholesale') {
            price = Math.round(price * 0.95);
          }
        } else {
          price = await calculatePriceAsync(product, session);
        }
        
        const itemTotal = price * item.quantity;
        total += itemTotal;
        
        message += `*${itemNum}. ${product.name}*`;
        if (heightSuffix) {
          message += ` _(${heightSuffix} см)_`;
        }
        message += `\n`;
        if (product.variety && !heightSuffix) {
          message += `   _${product.variety}_\n`;
        }
        message += `   📦 ${item.quantity} шт × ${price.toLocaleString('uk-UA')} грн\n`;
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
    
    const cartMsg = await ctx.reply(message, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
    registerMessage(session, cartMsg.message_id);
  });

  // Clear cart
  bot.action('clear_cart', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    session.cart = [];
    await ctx.answerCbQuery('Кошик очищено');
    await showMainMenu(ctx, session, true);
  });

  // Checkout - start contact details collection (with packaging check)
  bot.action('checkout', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    // Clear old messages before starting checkout
    try { await ctx.deleteMessage(); } catch {}
    await clearOldMessages(ctx, session);
    
    // Start collecting contact details
    session.step = 'checkout_name';
    session.checkoutData = {};
    
    const msg = await ctx.reply(
      '📝 *ОФОРМЛЕННЯ ЗАМОВЛЕННЯ*\n━━━━━━━━━━━━━━━━━━\n\nВведіть ваше *ім\'я та прізвище*:',
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Скасувати', 'cart')]
      ])}
    );
    registerMessage(session, msg.message_id);
  });

  // Helper function to show order confirmation
  const showOrderConfirmation = async (ctx: Context, session: UserSession) => {
    session.step = 'awaiting_confirmation';
    
    // Delete current message and clear old messages
    try { await ctx.deleteMessage(); } catch {}
    await clearOldMessages(ctx, session);
    
    // Calculate cart total for summary
    const products = await getCachedProducts();
    let total = 0;
    let itemsSummary = '';
    
    for (const item of session.cart) {
      // Check if item has height suffix (format: productId_h60)
      let productId = item.productId;
      let heightSuffix = '';
      if (item.productId.includes('_h')) {
        const parts = item.productId.split('_h');
        productId = parts[0];
        heightSuffix = parts[1];
      }
      
      const product = products.find(p => p.id === productId);
      if (product) {
        let price: number;
        
        // If height suffix exists, calculate price from heightPrices
        if (heightSuffix && (product as any).heightPrices) {
          const rateSetting = await storage.getSetting('usd_to_uah_rate');
          const rate = parseFloat(rateSetting?.value || '41.5');
          const heightPricesStr = (product as any).heightPrices;
          const priceParts = heightPricesStr.split(',').map((p: string) => p.trim());
          price = 0;
          for (const part of priceParts) {
            const [h, p] = part.split(':');
            if (h && h.trim() === heightSuffix && p) {
              price = Math.round(parseFloat(p.trim()) * rate);
              break;
            }
          }
          if (session.customerType === 'wholesale') {
            price = Math.round(price * 0.95);
          }
        } else {
          price = await calculatePriceAsync(product, session);
        }
        
        total += price * item.quantity;
        const heightInfo = heightSuffix ? ` (${heightSuffix} см)` : '';
        itemsSummary += `• ${product.name}${heightInfo} x${item.quantity}\n`;
      }
    }
    
    // Escape markdown special chars in user input
    const escapeMd = (text: string) => text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
    
    // Show order summary for confirmation
    let summary = '📋 *ПІДТВЕРДЖЕННЯ ЗАМОВЛЕННЯ*\n';
    summary += '━━━━━━━━━━━━━━━━━━\n\n';
    summary += `👤 *Ім'я:* ${escapeMd(session.checkoutData?.name || '')}\n`;
    summary += `📞 *Телефон:* ${escapeMd(session.checkoutData?.phone || '')}\n`;
    summary += `📍 *Адреса:* ${escapeMd(session.checkoutData?.address || '')}\n`;
    summary += `🎀 *Упаковка:* ${session.checkoutData?.needsPackaging ? 'Так' : 'Ні'}\n\n`;
    summary += `📦 *Товари:*\n${itemsSummary}\n`;
    summary += `💵 *Сума:* ${total.toLocaleString('uk-UA')} грн\n`;
    
    const summaryMsg = await ctx.reply(summary, { 
      parse_mode: 'Markdown', 
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Підтвердити', 'confirm_order')],
        [Markup.button.callback('✏️ Змінити дані', 'checkout')],
        [Markup.button.callback('❌ Скасувати', 'cart')]
      ])
    });
    registerMessage(session, summaryMsg.message_id);
  };
  
  // Packaging question - "No" goes to confirmation
  bot.action('packaging_no', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    await ctx.answerCbQuery();
    
    session.checkoutData = session.checkoutData || {};
    session.checkoutData.needsPackaging = false;
    
    // Go to order confirmation
    await showOrderConfirmation(ctx, session);
  });

  // Packaging question - "Yes" shows packaging products
  bot.action('packaging_yes', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    await ctx.answerCbQuery();
    
    session.checkoutData = session.checkoutData || {};
    session.checkoutData.needsPackaging = true;
    session.step = 'checkout_select_packaging';
    
    // Delete current message
    try { await ctx.deleteMessage(); } catch {}
    await clearOldMessages(ctx, session);
    
    // Get packaging products
    const products = await getCachedProducts();
    const packagingProducts = products.filter(p => {
      const flowerType = (p as any).flowerType;
      return flowerType?.category === 'packaging' ||
        p.name.toLowerCase().includes('упакування') ||
        p.name.toLowerCase().includes('плівка') ||
        p.name.toLowerCase().includes('папір');
    });
    
    if (packagingProducts.length === 0) {
      // No packaging products, go to confirmation
      await showOrderConfirmation(ctx, session);
      return;
    }
    
    // Show packaging products with 1, 5, 25 qty buttons
    let message = '🎀 *ОБЕРІТЬ УПАКОВКУ*\n━━━━━━━━━━━━━━━━━━\n\n';
    const buttons: any[] = [];
    
    for (const product of packagingProducts) {
      const price = await calculatePriceAsync(product, session);
      const shortId = product.id.substring(0, 8);
      message += `*${product.name}* - ${price.toLocaleString('uk-UA')} грн/шт\n`;
      buttons.push([
        Markup.button.callback(`${product.name}: +1`, `pkg_1_${shortId}`),
        Markup.button.callback('+5', `pkg_5_${shortId}`),
        Markup.button.callback('+25', `pkg_25_${shortId}`)
      ]);
    }
    
    message += '\n_Оберіть кількість упаковки або натисніть "Далі"_';
    
    buttons.push([Markup.button.callback('➡️ Далі', 'packaging_done')]);
    buttons.push([Markup.button.callback('❌ Скасувати', 'cart')]);
    
    const msg = await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });
    registerMessage(session, msg.message_id);
  });

  // Add packaging to cart
  bot.action(/^pkg_(\d+)_([a-f0-9]+)$/, async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const quantity = parseInt(ctx.match[1]);
    const shortId = ctx.match[2];
    await ctx.answerCbQuery(`Додано ${quantity} шт`);
    
    // Find full product ID
    const products = await getCachedProducts();
    const product = products.find(p => p.id.startsWith(shortId));
    
    if (product) {
      // Add to cart
      const existing = session.cart.find(item => item.productId === product.id);
      if (existing) {
        existing.quantity += quantity;
      } else {
        session.cart.push({ productId: product.id, quantity });
      }
    }
  });

  // Done selecting packaging
  bot.action('packaging_done', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    await ctx.answerCbQuery();
    
    await showOrderConfirmation(ctx, session);
  });
  
  // Handle packaging selection during checkout
  bot.action(/^pkg_(.+)$/, async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const shortId = ctx.match[1];
    await ctx.answerCbQuery('Упаковку додано');
    
    // Find full product ID from short ID
    const products = await getCachedProducts();
    const product = products.find(p => p.id.startsWith(shortId) && p.catalogType === 'packaging');
    
    if (product) {
      // Add 1 packaging to cart
      const existingItem = session.cart.find(i => i.productId === product.id);
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        session.cart.push({ productId: product.id, quantity: 1 });
      }
    }
    
    // Proceed to contact details
    session.step = 'checkout_name';
    session.checkoutData = {};
    
    try { await ctx.deleteMessage(); } catch {}
    
    await ctx.reply(
      '📝 *ОФОРМЛЕННЯ ЗАМОВЛЕННЯ*\n━━━━━━━━━━━━━━━━━━\n\n✅ Упаковку додано!\n\nВведіть ваше *ім\'я та прізвище*:',
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Скасувати', 'cart')]
      ])}
    );
  });
  
  // Skip packaging during checkout
  bot.action('skip_packaging', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    await ctx.answerCbQuery();
    
    // Proceed to contact details
    session.step = 'checkout_name';
    session.checkoutData = {};
    
    try { await ctx.deleteMessage(); } catch {}
    
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
    
    // Delete confirmation message and clear old messages
    try { await ctx.deleteMessage(); } catch {}
    await clearOldMessages(ctx, session);
    
    // Create order in storage
    const products = await getCachedProducts();
    let total = 0;
    const items: { product: Product; quantity: number; price: number; total: number; heightSuffix?: string }[] = [];
    
    for (const item of session.cart) {
      // Check if item has height suffix (format: productId_h60)
      let productId = item.productId;
      let heightSuffix = '';
      if (item.productId.includes('_h')) {
        const parts = item.productId.split('_h');
        productId = parts[0];
        heightSuffix = parts[1];
      }
      
      const product = products.find(p => p.id === productId);
      if (product) {
        let price: number;
        
        // If height suffix exists, calculate price from heightPrices
        if (heightSuffix && (product as any).heightPrices) {
          const rateSetting = await storage.getSetting('usd_to_uah_rate');
          const rate = parseFloat(rateSetting?.value || '41.5');
          const heightPricesStr = (product as any).heightPrices;
          const priceParts = heightPricesStr.split(',').map((p: string) => p.trim());
          price = 0;
          for (const part of priceParts) {
            const [h, p] = part.split(':');
            if (h && h.trim() === heightSuffix && p) {
              price = Math.round(parseFloat(p.trim()) * rate);
              break;
            }
          }
          // Apply wholesale discount if applicable
          if (session.customerType === 'wholesale') {
            price = Math.round(price * 0.95);
          }
        } else {
          price = await calculatePriceAsync(product, session);
        }
        
        const itemTotal = price * item.quantity;
        total += itemTotal;
        items.push({ product, quantity: item.quantity, price, total: itemTotal, heightSuffix: heightSuffix || undefined });
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
    
    // Calculate referral balance discount (will be applied and deducted on order completion)
    let referralDiscountApplied = 0;
    const referralBalance = parseFloat(customer?.referralBalance || '0');
    if (referralBalance > 0) {
      // Apply up to 100% of referral balance (max the total amount)
      referralDiscountApplied = Math.min(referralBalance, total);
      if (referralDiscountApplied > 0) {
        total -= referralDiscountApplied;
        // Note: Balance will be deducted when order is completed (not now)
        // This ensures balance is only used for successfully completed orders
      }
    }
    
    // Create order with beautiful number
    const orderNumber = `FL-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    
    // Build order items description
    let itemsDescription = items.map(i => {
      const heightInfo = i.heightSuffix ? ` (${i.heightSuffix} см)` : '';
      return `${i.product.name}${heightInfo} x${i.quantity}`;
    }).join(', ');
    if (itemsDescription.length > 200) {
      itemsDescription = itemsDescription.substring(0, 197) + '...';
    }
    
    const packagingNote = session.checkoutData?.needsPackaging ? ' | Упаковка: Так' : '';
    const order = await storage.createOrder({
      orderNumber,
      customerId: customer.id,
      status: 'new',
      totalUah: total.toString(),
      comment: `${session.city || ''} | ${itemsDescription}${packagingNote}${discountApplied > 0 ? ' | Знижка -' + discountApplied + ' грн' : ''}`
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
    
    // Referral bonus will be awarded when order is confirmed (in admin panel)
    // This ensures the bonus is only given for real completed orders
    
    // Exclude loyalty update from checkout, only handle in order status update
    /* 
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
    */

    // Send confirmation to user
    let bonusMessage = '';
    const pointsEarned = Math.floor(total / 1000);
    const nextOrderDiscount = ((customer.totalOrders || 0) + 1) % 10 === 0 ? '1000' : '0';
    if (discountApplied > 0) {
      bonusMessage += `\n\n✅ *Застосовано знижку:* -${discountApplied.toLocaleString('uk-UA')} грн`;
    }
    if (referralDiscountApplied > 0) {
      bonusMessage += `\n\n🎁 *Використано реферальний бонус:* -${referralDiscountApplied.toLocaleString('uk-UA')} грн`;
    }
    if (nextOrderDiscount === '1000') {
      bonusMessage += '\n\n🎁 *Вітаємо! Наступне замовлення зі знижкою 1000 грн!*';
    } else if ((customer.loyaltyPoints || 0) + pointsEarned >= 100) {
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
      confirmMessage += `   ${item.quantity} шт × ${item.price.toLocaleString('uk-UA')} грн\n`;
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
    // Exclude packaging from promotions
    const promos = products.filter(p => p.isPromo && p.catalogType !== 'packaging');
    
    if (promos.length === 0) {
      await ctx.editMessageText('Наразі немає акційних товарів', Markup.inlineKeyboard([
        [Markup.button.callback('🌹 Каталог', 'catalog')],
        [Markup.button.callback('🏠 Меню', 'menu')]
      ]));
      return;
    }
    
    // Clear old messages before sending product cards
    try { await ctx.deleteMessage(); } catch {}
    await clearOldMessages(ctx, session);
    
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
      await ctx.editMessageText(
        '📦 *ІСТОРІЯ ЗАМОВЛЕНЬ*\n━━━━━━━━━━━━━━━━━━\n\n_У вас ще немає замовлень_\n\nОформіть перше замовлення!',
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
          [Markup.button.callback('🌹 Каталог', 'catalog')],
          [Markup.button.callback('🏠 Меню', 'menu')]
        ])}
      );
      return;
    }
    
    const orders = await storage.getCustomerOrders(customer.id);
    
    if (orders.length === 0) {
      await ctx.editMessageText(
        '📦 *ІСТОРІЯ ЗАМОВЛЕНЬ*\n━━━━━━━━━━━━━━━━━━\n\n_У вас ще немає замовлень_\n\nОформіть перше замовлення!',
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
          [Markup.button.callback('🌹 Каталог', 'catalog')],
          [Markup.button.callback('🏠 Меню', 'menu')]
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
    
    await ctx.editMessageText(message, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('🌹 Каталог', 'catalog')],
      [Markup.button.callback('🏠 Головне меню', 'menu')]
    ])});
  });

  // Manager
  bot.action('manager', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    try {
      await ctx.answerCbQuery();
    } catch (e) {
      console.error('Callback answer error:', e);
    }
    
    // Clear old messages before sending new ones
    try { await ctx.deleteMessage(); } catch {}
    await clearOldMessages(ctx, session);
    
    const buttons = Markup.inlineKeyboard([
      [Markup.button.callback('🏠 Головне меню', 'menu')]
    ]);

    const msg = await ctx.reply(txt.managerContact, { 
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true },
      reply_markup: buttons.reply_markup
    });
    registerMessage(session, msg.message_id);
  });

  // About
  bot.action('about', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    await ctx.editMessageText(txt.aboutText, { 
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Головне меню', 'menu')]
      ]).reply_markup
    });
  });

  bot.action('search', async (ctx) => {
    console.log('🔍 Search action triggered');
    const session = getSession(ctx.from!.id.toString());
    session.step = 'search';
    console.log('🔍 Session step set to search');
    await ctx.answerCbQuery();
    
    // Clear old messages and send new prompt (can't edit media messages)
    await clearOldMessages(ctx, session);
    console.log('🔍 Old messages cleared');
    
    const msg = await ctx.reply(
      '🔍 *Пошук товарів*\n\nВведіть назву квітки або сорт для пошуку:',
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Меню', 'menu')]
      ])}
    );
    session.messagesToDelete.push(msg.message_id);
  });

  // Packaging section
  bot.action('packaging', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    await ctx.answerCbQuery();
    
    // Get packaging products (catalogType: packaging)
    const products = await getCachedProducts();
    const packagingProducts = products.filter(p => 
      p.catalogType === 'packaging' ||
      p.name.toLowerCase().includes('упакування') || 
      p.name.toLowerCase().includes('стрічка') ||
      p.name.toLowerCase().includes('папір') ||
      p.name.toLowerCase().includes('коробка') ||
      p.name.toLowerCase().includes('packaging')
    );
    
    if (packagingProducts.length === 0) {
      await ctx.editMessageText(
        '🎀 *Упакування*\n\nНаразі упакування не додано в каталог.',
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Меню', 'menu')]
        ])}
      );
      return;
    }
    
    // Delete current message and show packaging products
    try { await ctx.deleteMessage(); } catch {}
    
    for (const product of packagingProducts.slice(0, 5)) {
      await sendProductCard(ctx, product, session);
    }
    
    if (packagingProducts.length > 5) {
      await ctx.reply(`Показано 5 з ${packagingProducts.length} товарів`);
    }
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
    
    await ctx.editMessageText(txt.loyaltyInfo(points, orders), Markup.inlineKeyboard([
      [Markup.button.callback('🏠 Головне меню', 'menu')]
    ]));
  });

  // Referral Program
  bot.action('referral', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    const telegramId = ctx.from!.id.toString();
    await ctx.answerCbQuery();
    
    const customers = await storage.getCustomers();
    const customer = customers.find(c => c.telegramId === telegramId);
    
    if (!customer) {
      await ctx.editMessageText('❌ Клієнт не знайдений', Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Головне меню', 'menu')]
      ]));
      return;
    }
    
    const code = customer.referralCode || 'N/A';
    const balance = parseFloat(customer.referralBalance || '0');
    const count = customer.referralCount || 0;
    const botUsername = ctx.botInfo?.username || 'kvitka_opt_bot';
    
    await ctx.editMessageText(
      txt.referralInfo(code, balance, count, botUsername),
      { 
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Головне меню', 'menu')]
        ])
      }
    );
  });

  // Settings
  bot.action('settings', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    await ctx.editMessageText(
      txt.settingsMenu,
      Markup.inlineKeyboard([
        [Markup.button.callback(txt.changeLanguage, 'change_lang')],
        [Markup.button.callback(txt.changeCity, 'change_city')],
        [Markup.button.callback(txt.changeType, 'change_type')],
        [Markup.button.callback(txt.menuButton, 'menu')]
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
    await showMainMenu(ctx, session, true);
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
    await showMainMenu(ctx, session, true);
  });

  // Handle bot errors gracefully
  bot.catch((err: any, ctx: any) => {
    console.error('❌ Bot error:', err.message || err);
  });

  // Launch bot with delay to ensure server is ready first
  setTimeout(async () => {
    try {
      await bot.launch({ dropPendingUpdates: true });
      console.log('');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║              🤖 Telegram Bot Started 🤖                    ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('');
    } catch (err: any) {
      console.error('');
      console.error('❌ Failed to start Telegram bot:', err.message || err);
      console.error('');
    }
  }, 5000);

  // Graceful stop - only on SIGINT (Ctrl+C), not on SIGTERM
  process.once('SIGINT', () => {
    console.log('Stopping Telegram bot...');
    bot.stop('SIGINT');
  });
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
