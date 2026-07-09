const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve('.env');
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
  const roles = ['admin', 'auditor', 'lawyer', 'client'];
  const credentials = [];

  for (const role of roles) {
    const username = `${role}_user`;
    const email = `${username}@app.internal`;
    const password = Math.random().toString(36).slice(-8) + 'Aa1!';
    
    console.log(`Creating user for role ${role}...`);
    
    // Check if user already exists
    const { data: profileCheck } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    
    if (profileCheck) {
      console.log(`User ${email} already exists. Attempting to delete from auth.users...`);
      const { error: delErr } = await supabase.auth.admin.deleteUser(profileCheck.id);
      if (delErr) console.error("Failed to delete existing user:", delErr.message);
    }
    
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: `${role} User`, username: username }
    });
    
    if (createError) {
      console.error(`Failed to create ${role}:`, createError);
      continue;
    }

    const userId = newUser.user.id;

    // Upsert profile
    await supabase.from('profiles').upsert({
      id: userId,
      email: email,
      username: username,
      full_name: `${role} User`
    });

    // Assign role
    await supabase.from('user_roles').upsert({
      user_id: userId,
      role: role
    });

    credentials.push({ role, username, email, password });
  }

  console.log("\n--- CREATED CREDENTIALS ---");
  console.table(credentials);
}

run();
