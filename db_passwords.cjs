const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:YBS6HSph9GwuPUiL@db.avmgtsonawtzebvazgcr.supabase.co';

async function updatePasswords() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const res = await client.query(`
    SELECT id, email FROM auth.users 
    WHERE email LIKE '%@app.internal' AND email LIKE '%.main%'
  `);

  console.log("Found users:");
  console.table(res.rows);

  const newPass = 'QaZ123!@#';
  const credentials = [];

  for (const user of res.rows) {
    await client.query(`
      UPDATE auth.users
      SET encrypted_password = crypt($1, gen_salt('bf'))
      WHERE id = $2
    `, [newPass, user.id]);
    
    const role = user.email.split('.')[0];
    credentials.push({ role, email: user.email, password: newPass });
  }

  console.log("\\n--- NEW CREDENTIALS ---");
  console.table(credentials);

  await client.end();
}

updatePasswords().catch(console.error);
