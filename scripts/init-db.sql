-- Drop old/conflicting tables first
DROP TABLE IF EXISTS mastra_traces CASCADE;
DROP TABLE IF EXISTS mastra_workflow_snapshot CASCADE;
DROP TABLE IF EXISTS mastra_evals CASCADE;
DROP TABLE IF EXISTS mastra_threads CASCADE;
DROP TABLE IF EXISTS mastra_resources CASCADE;
DROP TABLE IF EXISTS mastra_ai_spans CASCADE;
DROP TABLE IF EXISTS mastra_messages CASCADE;
DROP TABLE IF EXISTS mastra_scorers CASCADE;
DROP TABLE IF EXISTS account_groups CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS recipients CASCADE;
DROP TABLE IF EXISTS logs CASCADE;
DROP TABLE IF EXISTS pending_auth CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;

-- Drop our tables to recreate fresh
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS plantations CASCADE;
DROP TABLE IF EXISTS flower_types CASCADE;
DROP TABLE IF EXISTS countries CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create countries table
CREATE TABLE countries (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code VARCHAR(2) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  flag TEXT NOT NULL
);

-- Create plantations table
CREATE TABLE plantations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  country_id VARCHAR NOT NULL
);

-- Create flower_types table
CREATE TABLE flower_types (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  category TEXT NOT NULL
);

-- Create products table
CREATE TABLE products (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  variety TEXT NOT NULL,
  type_id VARCHAR NOT NULL,
  country_id VARCHAR NOT NULL,
  plantation_id VARCHAR,
  flower_class TEXT NOT NULL,
  height INTEGER NOT NULL,
  color TEXT NOT NULL,
  price_usd DECIMAL(10, 2),
  price_uah DECIMAL(10, 2),
  pack_size INTEGER DEFAULT 25,
  status TEXT NOT NULL DEFAULT 'available',
  expected_date TIMESTAMP,
  is_promo BOOLEAN DEFAULT FALSE,
  images TEXT[],
  catalog_type TEXT NOT NULL DEFAULT 'preorder',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create customers table
CREATE TABLE customers (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  telegram_id TEXT UNIQUE,
  telegram_username TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  shop_name TEXT,
  city TEXT,
  address TEXT,
  customer_type TEXT NOT NULL DEFAULT 'flower_shop',
  language TEXT DEFAULT 'ua',
  loyalty_points INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(12, 2) DEFAULT 0,
  next_order_discount DECIMAL(10, 2) DEFAULT 0,
  is_blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create orders table
CREATE TABLE orders (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_number TEXT NOT NULL UNIQUE,
  customer_id VARCHAR NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  total_uah DECIMAL(12, 2) NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create order_items table
CREATE TABLE order_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id VARCHAR NOT NULL,
  product_id VARCHAR NOT NULL,
  quantity INTEGER NOT NULL,
  price_uah DECIMAL(10, 2) NOT NULL,
  total_uah DECIMAL(12, 2) NOT NULL
);

-- Create settings table
CREATE TABLE settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT
);

-- Create users table
CREATE TABLE users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'admin'
);

-- Insert default settings
INSERT INTO settings (key, value, description) VALUES
  ('usd_rate', '41.5', 'Курс USD до UAH'),
  ('min_order', '5000', 'Мінімальна сума замовлення в грн'),
  ('loyalty_threshold', '1000', 'Сума покупки для 1 бала лояльності'),
  ('loyalty_gift_points', '100', 'Кількість балів для подарунку'),
  ('discount_orders_count', '10', 'Кількість замовлень для знижки'),
  ('discount_amount', '1000', 'Сума знижки в грн');

-- Insert sample countries
INSERT INTO countries (code, name, flag) VALUES
  ('EC', 'Еквадор', '🇪🇨'),
  ('CO', 'Колумбія', '🇨🇴'),
  ('KE', 'Кенія', '🇰🇪'),
  ('NL', 'Нідерланди', '🇳🇱'),
  ('UA', 'Україна', '🇺🇦');

-- Insert sample flower types
INSERT INTO flower_types (name, category) VALUES
  ('Троянда', 'single'),
  ('Троянда кущова', 'spray'),
  ('Тюльпан', 'single'),
  ('Хризантема', 'spray'),
  ('Гербера', 'single'),
  ('Еустома', 'single'),
  ('Гвоздика', 'single'),
  ('Піон', 'single');

SELECT 'Database initialized successfully!' as status;
