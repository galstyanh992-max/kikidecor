// One-off script: create/replace the admin user in Supabase.
// Uses the direct Postgres pooler connection from .env.
import { Client } from "pg";

const EMAIL = "admin.kikidecor@kikidecor.ru";
const PASSWORD = "DekorAdmin2026!";

const conn = process.env.DATABASE_URL || "postgresql://postgres.ffxlohauqtklstulsjug:T3tDEKmAOhXJxZNl@aws-1-eu-west-1.pooler.supabase.com:5432/postgres";

const client = new Client({ connectionString: conn });

async function run() {
  await client.connect();

  // 1) Trigger function → grant admin to the new email on signup
  await client.query(`
    CREATE OR REPLACE FUNCTION public.handle_new_user_admin_role()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $function$
    BEGIN
      IF lower(NEW.email) = '${EMAIL}' THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'admin'::app_role)
        ON CONFLICT (user_id, role) DO NOTHING;
      END IF;
      RETURN NEW;
    END;
    $function$;
  `);

  await client.query(`
    DROP TRIGGER IF EXISTS on_auth_user_created_admin_role ON auth.users;
    CREATE TRIGGER on_auth_user_created_admin_role
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_admin_role();
  `);

  // 2) Create or update the admin user
  const res = await client.query(`
    DO $$
    DECLARE
      new_user_id uuid;
      existing_id uuid;
    BEGIN
      SELECT id INTO existing_id FROM auth.users WHERE lower(email) = '${EMAIL}';

      IF existing_id IS NULL THEN
        new_user_id := gen_random_uuid();
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, created_at, updated_at,
          raw_app_meta_data, raw_user_meta_data, is_super_admin,
          confirmation_token, recovery_token, email_change_token_new, email_change
        ) VALUES (
          '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated',
          '${EMAIL}',
          crypt('${PASSWORD}', gen_salt('bf')),
          now(), now(), now(),
          '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, '', '', '', ''
        );
        INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
        VALUES (
          gen_random_uuid(), new_user_id,
          jsonb_build_object('sub', new_user_id::text, 'email', '${EMAIL}', 'email_verified', true),
          'email', new_user_id::text, now(), now(), now()
        );
      ELSE
        new_user_id := existing_id;
        UPDATE auth.users
          SET encrypted_password = crypt('${PASSWORD}', gen_salt('bf')),
              email_confirmed_at = COALESCE(email_confirmed_at, now()),
              updated_at = now()
          WHERE id = new_user_id;
      END IF;

      -- 3) Grant admin role
      INSERT INTO public.user_roles (user_id, role)
      VALUES (new_user_id, 'admin'::app_role)
      ON CONFLICT (user_id, role) DO NOTHING;

      -- 4) Remove admin role from all other users
      DELETE FROM public.user_roles WHERE role = 'admin' AND user_id <> new_user_id;
    END $$;
  `);

  // 3) Verify
  const check = await client.query(
    `SELECT u.email, ur.role
     FROM auth.users u
     JOIN public.user_roles ur ON ur.user_id = u.id
     WHERE lower(u.email) = '${EMAIL}'`
  );

  console.log("OK. Admin user:", check.rows);
  await client.end();
}

run().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
