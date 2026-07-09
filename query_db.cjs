const { Client } = require('pg');
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

async function run() {
  const client = new Client({ connectionString: env.DATABASE_URL + ':5432/postgres' });
  try {
    await client.connect();
    const res = await client.query("SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'case_files_object_case_id';");
    console.log(res.rows[0]);
  } catch (err) {
    console.error(err.message);
  } finally {
    await client.end();
  }
}
run();
