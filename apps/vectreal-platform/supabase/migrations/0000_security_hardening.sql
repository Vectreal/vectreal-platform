-- Global reusable SQL hardening snippets.
-- This file is a reference library only.
-- Deployment is handled by files in `supabase/migrations`.

-- Prevent arbitrary object creation in public schema by default role.
revoke create on schema public from public;

-- Ensure API roles can still access public schema objects when explicitly granted.
grant usage on schema public to anon, authenticated, service_role;

-- Optional: lock down default execution on future functions in public.
-- Uncomment when all API-callable functions are explicitly granted.
-- alter default privileges in schema public revoke execute on functions from public;
