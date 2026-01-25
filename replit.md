# FlowerB2B - Адмін панель оптового продажу квітів + Telegram Bot

## Опис проекту
Веб-адмін панель та Telegram бот для B2B оптового продажу квітів. Система дозволяє керувати каталогом товарів, замовленнями, клієнтами та переглядати аналітику. Клієнти можуть робити замовлення через Telegram бот.

## Структура проекту

### Frontend (client/)
- **React** з TypeScript
- **Tailwind CSS** для стилізації  
- **shadcn/ui** компоненти
- **wouter** для роутингу
- **TanStack Query** для управління станом та API запитів
- **Recharts** для графіків аналітики

### Backend (server/)
- **Express.js** API сервер
- **PostgreSQL** база даних з Drizzle ORM
- **Telegraf** для Telegram бота

### Сторінки
- `/` - Дашборд зі статистикою
- `/orders` - Управління замовленнями
- `/products` - Каталог товарів
- `/customers` - База клієнтів
- `/analytics` - Аналітика та звіти
- `/countries` - Країни-постачальники
- `/plantations` - Плантації/ферми
- `/flower-types` - Типи квітів
- `/settings` - Налаштування системи
- `/notifications` - Масові розсилки
- `/promotions` - Акційні товари

## API Endpoints

### Dashboard
- `GET /api/dashboard/stats` - статистика дашборду

### Countries
- `GET /api/countries` - список країн
- `POST /api/countries` - створити країну
- `PATCH /api/countries/:id` - оновити країну
- `DELETE /api/countries/:id` - видалити країну

### Products  
- `GET /api/products` - список товарів
- `POST /api/products` - створити товар
- `PATCH /api/products/:id` - оновити товар
- `DELETE /api/products/:id` - видалити товар

### Orders
- `GET /api/orders` - список замовлень
- `GET /api/orders/recent` - останні замовлення
- `PATCH /api/orders/:id/status` - змінити статус
- `GET /api/orders/export` - експорт в CSV

### Customers
- `GET /api/customers` - список клієнтів
- `PATCH /api/customers/:id/block` - блокування клієнта
- `GET /api/customers/export` - експорт в CSV

### Settings
- `GET /api/settings` - налаштування
- `POST /api/settings/bulk` - масове оновлення

### Analytics
- `GET /api/analytics/top-products` - топ товари
- `GET /api/analytics/top-customers` - топ клієнти
- `GET /api/analytics/sales-by-country` - продажі по країнах
- `GET /api/analytics/sales-trend` - динаміка продажів

## Особливості

### Валюти
- Передзамовлення: базові ціни в USD, конвертація в UAH
- В наявності: ціни в UAH
- Налаштування курсу в Settings

### Статуси замовлень
- new (Нове)
- confirmed (Підтверджено)
- processing (В роботі)
- shipped (Відправлено)
- completed (Завершено)
- cancelled (Скасовано)

### Типи клієнтів
- flower_shop - Квітковий магазин
- wholesale - Великий опт (знижка -5%)

### Програма лояльності
- 1 бал = 1000 грн покупок
- 100 балів = подарунок
- 10 замовлень = знижка 1000 грн на 11-те замовлення

## Telegram Bot

### Функції бота
- Онбординг: вибір мови, міста, типу клієнта
- Каталог: Країна → Ферма → Тип квітів → Сорти (з фільтрами)
- Фільтри в каталозі: Клас (Standard/Premium/Garden), Висота (см), Колір
- Кошик з підрахунком суми
- Оформлення замовлення з контактними даними (ім'я, телефон, адреса)
- Історія замовлень
- Обрані товари
- Акційні товари
- Програма лояльності
- Пошук товарів
- Сповіщення про зміну статусу замовлення

### Структура каталогу бота
1. Вибір розділу: Передзамовлення / В наявності
2. Вибір країни (показуються тільки з товарами)
3. Вибір ферми/плантації (показуються тільки з товарами)
4. Вибір типу квітів (показуються тільки з товарами)
5. Фільтри: Клас, Висота, Колір
6. Перегляд товарів (сорти)

### Особливості бота
- Повертаючіся користувачі не проходять повторний онбординг
- Telegram username зберігається і відображається в адмін панелі
- Оптова знижка -5% для wholesale клієнтів
- Бейдж кількості нових замовлень в сайдбарі адмінки
- Редагування повідомлень замість відправки нових (краща UX)
- Кнопка "Меню" на всіх екранах для швидкого повернення

## Локальний запуск
```bash
npm run dev
```
Сервер стартує на порту 5000.

## Railway Deployment

### Env Variables (обов'язкові)
```
DATABASE_URL=postgresql://...
TELEGRAM_BOT_TOKEN=your_bot_token
SESSION_SECRET=random_secure_string
PORT=8080
```

### Build команди
```bash
npm install
npm run build
npm run start
```

### Налаштування Railway
1. New Project → Deploy from GitHub
2. Add PostgreSQL service
3. Set environment variables
4. Deploy!

### Файли для Railway
- `railway.json` - конфігурація деплою
- `Procfile` - стартова команда
- `nixpacks.toml` - налаштування збірки

### Завантаження фото
- Фото товарів зберігаються в `/uploads/`
- Автоматичне створення директорії
- Підтримка JPG, PNG, GIF, WebP
- Макс. розмір: 10MB

### API для завантаження
- `POST /api/upload` - одне фото
- `POST /api/upload-multiple` - декілька фото

### Важливо про зберігання файлів
Railway використовує ephemeral storage - файли втрачаються при редеплої.
Для production рекомендується використовувати:
- Cloudinary
- AWS S3
- Railway Volume (платно)

Або зберігати зображення за URL посиланнями замість локальних файлів.

### Env для зображень в боті
Для правильного відображення фото в Telegram боті на Railway:
- Railway автоматично встановлює RAILWAY_PUBLIC_DOMAIN
- Або встановіть BASE_URL вручну: `https://your-domain.railway.app`
