-- Railway Database Migration
-- Run these commands in Railway PostgreSQL console

-- Products table - add promo fields
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_promo BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_percent INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_end_date TIMESTAMP;
ALTER TABLE products ADD COLUMN IF NOT EXISTS catalog_type TEXT DEFAULT 'preorder';

-- Customers table - add referral bonus awarded flag
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_bonus_awarded BOOLEAN DEFAULT false;

-- Orders table - add referral discount pending
ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_discount_pending NUMERIC(10,2) DEFAULT 0;

-- Verify columns were added
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customers' ORDER BY ordinal_position;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'orders' ORDER BY ordinal_position;
