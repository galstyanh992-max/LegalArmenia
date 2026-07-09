import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve('d:\\1V\\LegalArmenia-clean\\.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envContent.split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('='))
);

const connectionString = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const client = new Client({ connectionString });

async function fix() {
  await client.connect();

  const { rows: users } = await client.query("SELECT id, email FROM auth.users WHERE email LIKE '%@app.internal'");
  console.log("Users found:", users.length);

  for (const u of users) {
    console.log(`Fixing ${u.email} (${u.id})`);
    
    // Insert into app.profiles
    await client.query(`
      INSERT INTO app.profiles (id, email, full_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO NOTHING
    `, [u.id, u.email, u.email.split('@')[0]]);

    // Insert into app.user_roles
    let role = 'client';
    if (u.email.startsWith('admin')) role = 'admin';
    if (u.email.startsWith('lawyer')) role = 'advocate';
    if (u.email.startsWith('auditor')) role = 'auditor';

    await client.query(`
      INSERT INTO app.user_roles (user_id, role)
      VALUES ($1, $2)
      ON CONFLICT (user_id, role) DO NOTHING
    `, [u.id, role]);
  }
  
  console.log("Done fixing app.profiles and app.user_roles via pg!");
  await client.end();
}

fix().catch(console.error);
