import { createClient } from '@supabase/supabase-js';
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

const SUPABASE_URL = env.SUPABASE_URL || 'https://avmgtsonawtzebvazgcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const roles = ['admin', 'auditor', 'lawyer', 'client'];
  const credentials = [];

  const { data: usersData, error: fetchError } = await supabase.auth.admin.listUsers();
  if (fetchError) {
    console.error("Fetch error:", fetchError);
    return;
  }

  for (const role of roles) {
    const password = Math.random().toString(36).slice(-8) + 'Aa1!';
    
    // Find ANY user matching role
    const targetUser = usersData.users.find(u => u.email && u.email.includes(role) && u.email.endsWith('@app.internal'));
    
    if (targetUser) {
      console.log(`Updating password for ${targetUser.email}...`);
      const { error: updateError } = await supabase.auth.admin.updateUserById(targetUser.id, {
        password: password
      });
      if (updateError) {
        console.error(`Failed to update ${targetUser.email}:`, updateError);
      } else {
        credentials.push({ role, email: targetUser.email, username: targetUser.email.split('@')[0], password });
      }
    } else {
      console.log(`User for ${role} not found, skipping.`);
    }
  }

  console.log("\n--- CREDENTIALS ---");
  console.table(credentials);
}

run();
