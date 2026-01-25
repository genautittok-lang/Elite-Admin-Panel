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
  console.log('║           🌸 FlowerB2B Database Check 🌸                    ║');
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
      console.log('📦 Tables already exist - skipping initialization');
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
