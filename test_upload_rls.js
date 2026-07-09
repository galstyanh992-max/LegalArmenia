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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'lawyer_user@app.internal',
    password: 'dhtezq4vAa1!'
  });

  if (authError) {
    console.error("Auth error:", authError);
    return;
  }

  const userId = authData.user.id;
  console.log("Logged in as:", userId);

  const safeName = 'DataLex_ԴԱՏԱԿԱՆ_ՏԵՂԵԿԱՏՎԱԿԱՆ_ՀԱՄԱԿԱՐԳ.pdf'.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}/autofill/${Date.now()}_${safeName}`;
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('case-files')
    .upload(storagePath, 'hello world', {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
  } else {
    console.log("Upload success:", uploadData);
  }
}

run();
