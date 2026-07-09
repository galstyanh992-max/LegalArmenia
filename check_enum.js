import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve('d:\\1V\\LegalArmenia-clean\\.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envContent.split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('='))
);

const supabaseApp = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkEnum() {
  const { data, error } = await supabaseApp.rpc('get_enum_values', { enum_name: 'app_role' });
  if (error) {
    // try direct query via rest if there's a way, but there isn't.
    console.log("Cannot get enum values via RPC, let's just try inserting 'lawyer'.");
  } else {
    console.log("Enum values:", data);
  }
}

checkEnum().catch(console.error);
