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

async function testExtract() {
  const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'temp_extract_test@app.internal',
    password: 'password123'
  });
  
  if (signInError) return console.error(signInError);
  const token = authData.session.access_token;
  const userId = authData.user.id;
  
  const fileName = 'test_autofill.jpg';
  const storagePath = `${userId}/autofill/${Date.now()}_${fileName}`;
  
  // A tiny 1x1 transparent JPG (actually just valid base64 image)
  const buffer = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
  const { error: uploadError } = await supabase.storage.from('case-files').upload(storagePath, buffer, {
    contentType: 'image/jpeg'
  });
  
  if (uploadError) return console.error("Upload error:", uploadError);
  
  const fileRefs = [{
    bucket: 'case-files',
    path: storagePath,
    name: fileName,
    mime: 'image/jpeg',
    size: buffer.length
  }];

  const functionUrl = `${SUPABASE_URL}/functions/v1/extract-case-form-fields`;
  console.log(`Calling ${functionUrl}`);
  
  const resp = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Origin': 'http://localhost:5173'
    },
    body: JSON.stringify({ files: fileRefs })
  });

  const responseText = await resp.text();
  console.log("Status:", resp.status);
  console.log("Response:", responseText);
  
  // cleanup
  await supabase.storage.from('case-files').remove([storagePath]);
}

testExtract();
