import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve('d:\\1V\\LegalArmenia-clean\\.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envContent.split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('='))
);

const supabaseAdmin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: profiles, error } = await supabaseAdmin.from('profiles').select('*');
  console.log("Profiles:", profiles);
  console.log("Error:", error);
}

check().catch(console.error);
