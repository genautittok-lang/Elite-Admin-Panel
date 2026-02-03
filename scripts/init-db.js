import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

async function initDatabase() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           🌸 KVITKA opt Database Check 🌸                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set!');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('📡 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected successfully!');
    console.log('');

    // Check if tables already exist
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'customers'
      );
    `);

    if (checkResult.rows[0].exists) {
      console.log('📦 Tables already exist - running migrations...');
      
      // Run migrations to add missing columns and fix column types
      const migrations = [
        // Products table - fix height column type (should be TEXT, not INTEGER)
        `ALTER TABLE products ALTER COLUMN height TYPE TEXT USING height::TEXT`,
        // Products table - make type_id and country_id nullable (for packaging products)
        `ALTER TABLE products ALTER COLUMN type_id DROP NOT NULL`,
        `ALTER TABLE products ALTER COLUMN country_id DROP NOT NULL`,
        // Products table - all new fields
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_promo BOOLEAN DEFAULT false`,
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_percent INTEGER DEFAULT 0`,
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_end_date TIMESTAMP`,
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS catalog_type TEXT DEFAULT 'preorder'`,
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT[]`,
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS videos TEXT[]`,
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS expected_date TIMESTAMP`,
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS pack_size INTEGER DEFAULT 25`,
        // Customers table - referral fields
        `ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_bonus_awarded BOOLEAN DEFAULT false`,
        `ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_code TEXT`,
        `ALTER TABLE customers ADD COLUMN IF NOT EXISTS referred_by TEXT`,
        `ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_balance NUMERIC(10,2) DEFAULT 0`,
        `ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0`,
        // Orders table - referral discount pending
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_discount_pending NUMERIC(10,2) DEFAULT 0`,
      ];
      
      for (const migration of migrations) {
        try {
          await client.query(migration);
        } catch (err) {
          // Ignore errors (column might already exist)
        }
      }
      
      console.log('✅ Migrations applied successfully');
      console.log('');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║              ✅ Database ready!                            ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('');
      client.release();
      return;
    }

    // Tables don't exist - create them
    console.log('🆕 First run - initializing database...');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, 'init-db.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🗑️  Dropping old tables...');
    console.log('📦 Creating new tables...');
    console.log('⚙️  Inserting default settings...');
    console.log('');

    // Execute SQL
    await client.query(sql);

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║            ✅ Database initialized successfully!           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

    client.release();
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();
