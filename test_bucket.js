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

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.storage.getBucket('case-files');
  if (error) {
    console.error("Bucket error:", error);
  } else {
    console.log("Bucket exists:", data.name);
  }

  // test upload
  const { data: uploadData, error: uploadError } = await supabase.storage.from('case-files').upload('test-admin-upload.txt', 'hello', { upsert: true });
  if (uploadError) {
    console.error("Admin upload error:", uploadError);
  } else {
    console.log("Admin upload success:", uploadData);
  }
}

run();
