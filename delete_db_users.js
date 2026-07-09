import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve('d:\\1V\\LegalArmenia-clean\\.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const idx = line.indexOf('=');
      if (idx === -1) return null;
      let key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      return [key, val];
    })
    .filter(Boolean)
);

const DATABASE_URL = env.DATABASE_URL;

async function run() {
  if (!DATABASE_URL) {
    console.error("No DATABASE_URL found");
    process.exit(1);
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to database.");

    // Delete all dependent data
    console.log("Truncating cases and related tables to clear constraints...");
    await client.query(`
      TRUNCATE TABLE public.case_files CASCADE;
      TRUNCATE TABLE public.case_comments CASCADE;
      TRUNCATE TABLE public.cases CASCADE;
      TRUNCATE TABLE public.profiles CASCADE;
      TRUNCATE TABLE public.user_roles CASCADE;
    `);
    
    // Actually, truncating profiles cascade might be enough, but let's delete from auth.users
    console.log("Deleting all users except the ones we just created...");
    // Keep the newly created ones by checking created_at or email
    await client.query(`
      DELETE FROM auth.users WHERE email NOT LIKE '%@app.internal'
    `);
    console.log("Users deleted successfully.");

  } catch (error) {
    console.error("Error executing SQL:", error);
  } finally {
    await client.end();
  }
}

run();
