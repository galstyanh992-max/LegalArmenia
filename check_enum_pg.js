import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve('d:\\1V\\LegalArmenia-clean\\.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envContent.split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('='))
);

const connectionString = env.DATABASE_URL;

const client = new Client({ connectionString });

async function checkEnum() {
  await client.connect();
  const res = await client.query(`
    SELECT enumlabel 
    FROM pg_enum 
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
    WHERE typname = 'app_role'
  `);
  console.log("Enum app_role labels:");
  console.log(res.rows.map(r => r.enumlabel));
  await client.end();
}

checkEnum().catch(console.error);
