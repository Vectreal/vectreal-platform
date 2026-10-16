/**
 * The `aud` claim on access tokens Supabase Auth issues to OAuth clients: the
 * CLI, MCP servers, any agent acting for a user.
 *
 * Written by the `custom_access_token_hook` database function (migration
 * 0028) and required by the agent API's token check, so a first-party session
 * token, whose audience stays `authenticated`, is never accepted as an agent
 * token. The two are separate code, held together by
 * `tests/integration/custom-access-token-hook.integration.spec.ts`.
 *
 * One value in every environment. A staging token cannot be replayed against
 * production regardless, because each project signs with its own keys, and
 * the origin covers every resource the platform serves to agents.
 */
export const AGENT_TOKEN_AUDIENCE = 'https://vectreal.com'
