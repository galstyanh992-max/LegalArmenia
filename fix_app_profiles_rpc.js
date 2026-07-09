import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve('d:\\1V\\LegalArmenia-clean\\.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envContent.split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('='))
);

const supabaseAuth = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseApp = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'app' } });

async function fixProfiles() {
  const { data: { users }, error: authError } = await supabaseAuth.auth.admin.listUsers();
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }

  for (const user of users) {
    if (user.email && user.email.endsWith('@app.internal')) {
      console.log(`Fixing app.user_profiles for ${user.email} (${user.id})`);
      
      let role = 'client';
      if (user.email.startsWith('admin')) role = 'admin';
      if (user.email.startsWith('lawyer')) role = 'advocate';
      if (user.email.startsWith('auditor')) role = 'auditor';

      const { error: profileError } = await supabaseApp.from('user_profiles').upsert({
        user_id: user.id,
        email: user.email,
        full_name: user.email.split('@')[0],
        app_role: role
      });
      if (profileError) console.error("Profile error:", profileError);
    }
  }
  console.log("Done fixing app.user_profiles.");
}

fixProfiles().catch(console.error);
