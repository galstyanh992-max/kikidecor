const { Client } = require("pg");
const c = new Client({ connectionString: "postgresql://postgres.ffxlohauqtklstulsjug:T3tDEKmAOhXJxZNl@aws-1-eu-west-1.pooler.supabase.com:5432/postgres" });
c.connect().then(async () => {
  const r = await c.query("SELECT u.email, u.email_confirmed_at, ur.role as app_role FROM auth.users u LEFT JOIN public.user_roles ur ON ur.user_id = u.id ORDER BY u.created_at DESC LIMIT 10");
  console.table(r.rows);
  await c.end();
}).catch((e) => { console.error(e.message); process.exit(1); });
