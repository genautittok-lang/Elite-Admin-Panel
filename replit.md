# FlowerB2B - Адмін панель оптового продажу квітів

## Опис проекту
Веб-адмін панель для B2B оптового продажу квітів. Система дозволяє керувати каталогом товарів, замовленнями, клієнтами та переглядати аналітику.

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
- **In-memory storage** для даних (MemStorage)

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
- 10 замовлень = -1000 грн на 11-те

## Запуск
```bash
npm run dev
```
Сервер стартує на порту 5000.
