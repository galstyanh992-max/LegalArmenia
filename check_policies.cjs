const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = require('path').resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx), line.slice(idx + 1).trim()];
    })
);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `SELECT polname, pg_get_expr(polqual, polrelid) as qual, pg_get_expr(polwithcheck, polrelid) as withcheck 
            FROM pg_policy 
            WHERE polrelid = 'storage.objects'::regclass;`
  });
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

run();
