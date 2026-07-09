import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve('d:\\1V\\LegalArmenia-clean\\.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envContent.split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('='))
);

const supabaseAdmin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function fixProfiles() {
  const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }

  for (const user of users) {
    if (user.email && user.email.endsWith('@app.internal')) {
      console.log(`Fixing profile for ${user.email} (${user.id})`);
      
      // Upsert profile
      const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
        id: user.id,
        email: user.email,
        full_name: user.email.split('@')[0],
      });
      if (profileError) console.error("Profile error:", profileError);

      // Upsert role based on email prefix
      let role = 'client';
      if (user.email.startsWith('admin')) role = 'admin';
      if (user.email.startsWith('lawyer')) role = 'advocate'; // lawyer is advocate role
      if (user.email.startsWith('auditor')) role = 'auditor';

      const { error: roleError } = await supabaseAdmin.from('user_roles').upsert({
        user_id: user.id,
        role: role,
      }, { onConflict: 'user_id, role' });
      if (roleError) console.error("Role error:", roleError);
    }
  }
  console.log("Done fixing profiles and roles.");
}

fixProfiles().catch(console.error);
