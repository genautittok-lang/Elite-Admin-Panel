import { Telegraf, Markup, Context } from 'telegraf';
import { storage } from './storage';
import type { Product, Customer, Country, FlowerType } from '@shared/schema';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.warn("TELEGRAM_BOT_TOKEN is not set. Telegram bot will not start.");
}

export const bot = token ? new Telegraf(token) : null;

// User session storage (in-memory for now)
interface UserSession {
  language: 'ua' | 'en' | 'ru';
  city?: string;
  customerType?: 'flower_shop' | 'wholesale';
  cart: { productId: string; quantity: number }[];
  favorites: string[];
  step: 'language' | 'city' | 'type' | 'menu' | 'catalog' | 'product' | 'cart' | 'order';
  currentCountry?: string;
  currentType?: string;
  currentProduct?: string;
}

const sessions: Map<string, UserSession> = new Map();

function getSession(telegramId: string): UserSession {
  if (!sessions.has(telegramId)) {
    sessions.set(telegramId, {
      language: 'ua',
      cart: [],
      favorites: [],
      step: 'language'
    });
  }
  return sessions.get(telegramId)!;
}

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
    welcome: (name: string) => `Вітаємо у FlowerB2B, ${name}! 🌸\n\nВаш персональний помічник для оптових замовлень квітів.\n\nТут ви можете:\n✅ Переглядати актуальний асортимент у реальному часі\n✅ Дізнаватися персональні ціни (з урахуванням знижок)\n✅ Формувати замовлення за лічені хвилини\n✅ Відстежувати статус своїх заявок\n✅ Накопичувати бонуси за програмою лояльності\n\nОберіть пункт меню для початку роботи:`,
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
    welcome: (name: string) => `Welcome to FlowerB2B, ${name}! 🌸\n\nYour personal assistant for wholesale flower orders.\n\nHere you can:\n✅ Browse current assortment in real-time\n✅ Check personal prices (including discounts)\n✅ Place orders in minutes\n✅ Track your order status\n✅ Earn bonuses with our loyalty program\n\nSelect a menu item to get started:`,
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
    welcome: (name: string) => `Добро пожаловать во FlowerB2B, ${name}! 🌸\n\nВаш персональный помощник для оптовых заказов цветов.\n\nЗдесь вы можете:\n✅ Просматривать актуальный ассортимент в реальном времени\n✅ Узнавать персональные цены (с учетом скидок)\n✅ Формировать заказы за считанные минуты\n✅ Отслеживать статус своих заявок\n✅ Накапливать бонусы по программе лояльности\n\nВыберите пункт меню для начала работы:`,
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
  const price = calculatePrice(product, session);
  
  const statusMap: Record<string, string> = {
    available: txt.available,
    preorder: txt.preorderStatus,
    expected: txt.expected
  };
  
  let message = `${isPromo ? '🔥 АКЦІЯ! ' : ''}${product.name}\n`;
  message += `📍 ${product.variety}\n\n`;
  message += `${txt.class}: ${product.flowerClass}\n`;
  message += `${txt.height}: ${product.height} см\n`;
  message += `${txt.color}: ${product.color}\n`;
  message += `${statusMap[product.status] || product.status}\n\n`;
  message += `💰 ${txt.price}: ${price.toLocaleString()} грн/${txt.stem}`;
  
  const buttons = Markup.inlineKeyboard([
    [
      Markup.button.callback('+25', `add_cart_25_${product.id}`),
      Markup.button.callback('+50', `add_cart_50_${product.id}`),
      Markup.button.callback('+100', `add_cart_100_${product.id}`)
    ],
    [
      Markup.button.callback('+1 box', `add_cart_${product.packSize || 25}_${product.id}`),
      Markup.button.callback('❤️', `favorite_${product.id}`)
    ]
  ]);
  
  // Send photo if available
  if (product.images && product.images.length > 0) {
    try {
      await ctx.replyWithPhoto(product.images[0], {
        caption: message,
        reply_markup: buttons.reply_markup
      });
    } catch {
      await ctx.reply(message, buttons);
    }
  } else {
    await ctx.reply(message, buttons);
  }
}

if (bot) {
  // Start command - language selection
  bot.start(async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const session = getSession(telegramId);
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

  // City input (text handler)
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
          [Markup.button.callback(txt.flowerShop, 'type_flower_shop')],
          [Markup.button.callback(txt.wholesale, 'type_wholesale')]
        ])
      );
    } else if (session.step === 'menu') {
      // Search functionality
      const searchTerm = ctx.message.text.toLowerCase();
      const products = await storage.getProducts();
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
  bot.action(/^type_(flower_shop|wholesale)$/, async (ctx) => {
    const type = ctx.match[1] as 'flower_shop' | 'wholesale';
    const telegramId = ctx.from!.id.toString();
    const session = getSession(telegramId);
    session.customerType = type;
    session.step = 'menu';
    
    // Create or update customer during onboarding
    const customers = await storage.getCustomers();
    let customer = customers.find(c => c.telegramId === telegramId);
    
    if (!customer) {
      customer = await storage.createCustomer({
        telegramId,
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
        city: session.city,
        customerType: type,
        language: session.language
      });
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
      Markup.button.callback(t.name, `type_${catalogType}_${countryId}_${t.id}`)
    ]);
    buttons.push([Markup.button.callback(txt.back, `catalog_${catalogType}`)]);
    
    await ctx.editMessageText(
      `Тип квітів:`,
      Markup.inlineKeyboard(buttons)
    );
  });

  // Flower type selection - show products
  bot.action(/^type_(.+)_(.+)_(.+)$/, async (ctx) => {
    const [catalogType, countryId, typeId] = [ctx.match[1], ctx.match[2], ctx.match[3]];
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    const products = await storage.getProducts();
    const filtered = products.filter(p => 
      p.countryId === countryId && 
      p.typeId === typeId &&
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

  // Product actions
  bot.action(/^add_cart_(\d+)_(.+)$/, async (ctx) => {
    const quantity = parseInt(ctx.match[1]);
    const productId = ctx.match[2];
    const session = getSession(ctx.from!.id.toString());
    
    const existing = session.cart.find(c => c.productId === productId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      session.cart.push({ productId, quantity });
    }
    
    await ctx.answerCbQuery(`Додано ${quantity} шт. до кошика!`);
  });

  bot.action(/^favorite_(.+)$/, async (ctx) => {
    const productId = ctx.match[1];
    const session = getSession(ctx.from!.id.toString());
    
    if (session.favorites.includes(productId)) {
      session.favorites = session.favorites.filter(id => id !== productId);
      await ctx.answerCbQuery('Видалено з обраного');
    } else {
      session.favorites.push(productId);
      await ctx.answerCbQuery('Додано до обраного!');
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
    
    const products = await storage.getProducts();
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
    await ctx.answerCbQuery();
    
    if (session.cart.length === 0) {
      await ctx.reply(txt.cartEmpty, Markup.inlineKeyboard([
        [Markup.button.callback(txt.catalog, 'catalog')],
        [Markup.button.callback(txt.back, 'menu')]
      ]));
      return;
    }
    
    const products = await storage.getProducts();
    let total = 0;
    let message = `${txt.cartItems}\n\n`;
    
    for (const item of session.cart) {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        const price = calculatePrice(product, session);
        const itemTotal = price * item.quantity;
        total += itemTotal;
        message += `• ${product.name} (${product.variety})\n`;
        message += `  ${item.quantity} шт. × ${price} грн = ${itemTotal} грн\n\n`;
      }
    }
    
    message += `\n${txt.total} ${total.toLocaleString()} грн`;
    
    if (total < 5000) {
      message += `\n\n${txt.minOrder}`;
    }
    
    const buttons = [
      total >= 5000 ? [Markup.button.callback(txt.checkout, 'checkout')] : [],
      [Markup.button.callback(txt.clearCart, 'clear_cart')],
      [Markup.button.callback(txt.back, 'menu')]
    ].filter(row => row.length > 0);
    
    await ctx.reply(message, Markup.inlineKeyboard(buttons));
  });

  // Clear cart
  bot.action('clear_cart', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    session.cart = [];
    await ctx.answerCbQuery('Кошик очищено');
    await showMainMenu(ctx, session);
  });

  // Checkout
  bot.action('checkout', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    const telegramId = ctx.from!.id.toString();
    
    // Create order in storage
    const products = await storage.getProducts();
    let total = 0;
    const items = [];
    
    for (const item of session.cart) {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        const price = calculatePrice(product, session);
        const itemTotal = price * item.quantity;
        total += itemTotal;
        items.push({ product, quantity: item.quantity, price, total: itemTotal });
      }
    }
    
    // Find or create customer
    const customers = await storage.getCustomers();
    let customer = customers.find(c => c.telegramId === telegramId);
    
    if (!customer) {
      customer = await storage.createCustomer({
        telegramId,
        name: ctx.from!.first_name || 'Telegram User',
        phone: '',
        shopName: '',
        city: session.city || '',
        customerType: session.customerType || 'flower_shop',
        language: session.language,
        isBlocked: false
      });
    }
    
    // Create order
    const orderNumber = `ORD-${Date.now()}`;
    const order = await storage.createOrder({
      orderNumber,
      customerId: customer.id,
      status: 'new',
      totalUah: total.toString(),
      comment: `Telegram Order | Items: ${items.length}`
    });
    
    // Persist order items
    for (const item of items) {
      await storage.createOrderItem({
        orderId: order.id,
        productId: item.product.id,
        quantity: item.quantity,
        priceUah: item.price.toString(),
        totalUah: (item.price * item.quantity).toString()
      });
    }
    
    // Update customer loyalty (1 point per 1000 UAH)
    const newTotalSpent = parseFloat(customer.totalSpent || '0') + total;
    const pointsEarned = Math.floor(total / 1000);
    const newPoints = (customer.loyaltyPoints || 0) + pointsEarned;
    const newTotalOrders = (customer.totalOrders || 0) + 1;
    
    // Using cast for update because shared schema might not expose these fields for update
    await storage.updateCustomer(customer.id, {
      totalSpent: newTotalSpent.toString(),
      loyaltyPoints: newPoints,
      totalOrders: newTotalOrders
    } as any);
    
    // Check for 11th order discount (every 11th order gets -1000 UAH)
    let discountMessage = '';
    if (newTotalOrders % 11 === 0) {
      discountMessage = '\n🎁 Поздравляем! Это ваш 11-й заказ - скидка 1000 грн!';
      // Note: Discount should be applied to next order
    }
    
    // Clear cart
    session.cart = [];
    
    await ctx.answerCbQuery();
    await ctx.reply(
      `${txt.orderSuccess}\n\n📝 Номер заявки: ${orderNumber}\n💰 Сума: ${total.toLocaleString()} грн\n🏆 Бонусні бали: +${pointsEarned}${discountMessage}`,
      Markup.inlineKeyboard([[Markup.button.callback(txt.mainMenu, 'menu')]])
    );
  });

  // Promotions
  bot.action('promotions', async (ctx) => {
    const session = getSession(ctx.from!.id.toString());
    const txt = getText(session);
    await ctx.answerCbQuery();
    
    const products = await storage.getProducts();
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
      await ctx.reply(txt.noHistory, Markup.inlineKeyboard([
        [Markup.button.callback(txt.back, 'menu')]
      ]));
      return;
    }
    
    const orders = await storage.getCustomerOrders(customer.id);
    
    if (orders.length === 0) {
      await ctx.reply(txt.noHistory, Markup.inlineKeyboard([
        [Markup.button.callback(txt.back, 'menu')]
      ]));
      return;
    }
    
    const statusMap: Record<string, string> = {
      new: 'Нова',
      confirmed: 'Підтверджена',
      processing: 'В роботі',
      shipped: 'Відправлена',
      completed: 'Закрита',
      cancelled: 'Скасована'
    };
    
    let message = `${txt.history}:\n\n`;
    for (const order of orders.slice(0, 10)) {
      message += `📦 ${order.orderNumber}\n`;
      message += `   Статус: ${statusMap[order.status] || order.status}\n`;
      message += `   Сума: ${order.totalUah} грн\n\n`;
    }
    
    await ctx.reply(message, Markup.inlineKeyboard([
      [Markup.button.callback(txt.back, 'menu')]
    ]));
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
