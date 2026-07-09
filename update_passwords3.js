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

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const { data: profiles, error: fetchError } = await supabase.from('profiles').select('id, email');
  if (fetchError) {
    console.error("Fetch error:", fetchError);
    return;
  }

  const credentials = [];
  const roles = ['admin', 'auditor', 'lawyer', 'client'];

  for (const role of roles) {
    const password = Math.random().toString(36).slice(-8) + 'Aa1!';
    
    // Find the user
    const targetProfile = profiles.find(p => p.email && p.email.includes(role) && p.email.endsWith('@app.internal'));
    
    if (targetProfile) {
      console.log(`Updating password for ${targetProfile.email} (${targetProfile.id})...`);
      const { error: updateError } = await supabase.auth.admin.updateUserById(targetProfile.id, {
        password: password
      });
      if (updateError) {
        console.error(`Failed to update ${targetProfile.email}:`, updateError);
      } else {
        credentials.push({ role, email: targetProfile.email, password });
      }
    } else {
      console.log(`User for ${role} not found in profiles.`);
    }
  }

  console.log("\n--- NEW CREDENTIALS ---");
  console.table(credentials);
}

run();
