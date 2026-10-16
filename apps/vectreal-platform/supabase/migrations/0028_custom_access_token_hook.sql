-- ---------------------------------------------------------------------------
-- custom_access_token hook: an audience for agent tokens
-- ---------------------------------------------------------------------------
-- Supabase Auth calls this for every access token it issues, first-party
-- sessions and OAuth clients alike. An OAuth token carries a `client_id`
-- claim, and for those the audience becomes the Vectreal API, so the resource
-- server can require it and a first-party session (aud `authenticated`) never
-- passes as an agent token. Every other token is returned untouched.
--
-- Immutable on purpose: a hook that errors fails token issuance for every
-- login, so it reads nothing but its input, and Postgres rejects a write in an
-- immutable function rather than letting one slip in later.
--
-- The audience must equal AGENT_TOKEN_AUDIENCE in
-- app/lib/domain/agent/agent-token-audience.ts;
-- tests/integration/custom-access-token-hook.integration.spec.ts holds both.
--
-- Custom because Drizzle cannot express functions. 0027 revoked EXECUTE from
-- PUBLIC for new functions, so the grant below is what lets Auth call it.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
	SELECT CASE
		WHEN event -> 'claims' ->> 'client_id' IS NOT NULL
			THEN jsonb_set(event, '{claims,aud}', '"https://vectreal.com"')
		ELSE event
	END
$$;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
