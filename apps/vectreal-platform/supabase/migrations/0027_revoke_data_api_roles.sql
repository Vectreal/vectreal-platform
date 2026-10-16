-- ---------------------------------------------------------------------------
-- Close the public schema to the Data API roles
-- ---------------------------------------------------------------------------
-- `anon` and `authenticated` are the roles PostgREST and pg_graphql act as. The
-- app never goes through either: it reads and writes with Drizzle over a plain
-- connection, and Storage uses the secret key. So these grants serve no caller,
-- and any Supabase-issued JWT, including an OAuth token handed to a third-party
-- client, could otherwise reach the tables behind nothing but RLS.
--
-- Custom because Drizzle cannot express privileges, as in 0010, which revoked
-- five internal tables by name. This covers every object in the schema, and the
-- default privileges cover the tables later migrations create, which would
-- otherwise be granted to both roles automatically.
-- Functions are revoked from PUBLIC as well, because both roles inherit it and
-- Postgres grants EXECUTE to PUBLIC on every new function. That built-in
-- default is global, and a schema-scoped default can only add to it, so the
-- future-function line is not limited to `public`; it covers only functions
-- `postgres` creates, which is what migrations run as. So a function another
-- role has to call, such as an auth hook run by `supabase_auth_admin`, needs an
-- explicit GRANT EXECUTE, which Supabase's hook guide asks for anyway. 0000 left
-- this commented out until no API-callable function relied on it; none exists.
-- `tests/integration/data-api-roles.integration.spec.ts` holds the invariant.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
