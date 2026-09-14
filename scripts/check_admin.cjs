const { Client } = require("pg");
const c = new Client({ connectionString: "postgresql://postgres.ffxlohauqtklstulsjug:T3tDEKmAOhXJxZNl@aws-1-eu-west-1.pooler.supabase.com:5432/postgres" });
c.connect().then(async () => {
  const users = await c.query("SELECT id, email, email_confirmed_at FROM auth.users ORDER BY created_at DESC");
  console.log("=== USERS ===");
  console.table(users.rows);

  const roles = await c.query("SELECT user_id, role, created_at FROM public.user_roles");
  console.log("=== ROLES ===");
  console.table(roles.rows);

  const policies = await c.query("SELECT tablename, policyname, cmd, roles, qual FROM pg_policies WHERE tablename = 'user_roles'");
  console.log("=== RLS POLICIES on user_roles ===");
  console.table(policies.rows);

  const rls = await c.query("SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'user_roles'");
  console.log("=== RLS ENABLED ===");
  console.table(rls.rows);

  await c.end();
}).catch((e) => { console.error(e.message); process.exit(1); });
