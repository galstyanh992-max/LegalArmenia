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

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log("Cleaning up dependent data...");
  // Delete all cases, case_comments, case_files
  // Since we don't have cascade easily, let's delete them in order
  const tables = ['case_files', 'case_comments', 'case_members', 'cases', 'user_roles', 'profiles'];
  for (const table of tables) {
    console.log(`Deleting all from ${table}...`);
    // Delete all records where id is not null (which is all records)
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
       // if 'id' is not the primary key, we delete differently
       console.log(`Trying alternative delete for ${table}`);
       if (table === 'user_roles') {
         await supabase.from(table).delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
       } else if (table === 'case_members') {
         await supabase.from(table).delete().neq('case_id', '00000000-0000-0000-0000-000000000000');
       }
    }
  }

  console.log("Fetching all users to delete...");
  const { data: users, error: fetchError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  
  if (fetchError) {
    console.error("Error fetching users:", fetchError);
    return;
  }

  console.log(`Found ${users.users.length} users. Deleting...`);
  
  for (const user of users.users) {
    if (user.email.endsWith('@app.internal')) {
      // already created these, skip
      continue;
    }
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error(`Failed to delete user ${user.email}:`, deleteError);
    } else {
      console.log(`Deleted user ${user.email}`);
    }
  }

  console.log("Done.");
}

run();
