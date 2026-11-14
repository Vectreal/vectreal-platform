import { describeAgentScope } from './agent-operation-scopes'

/**
 * What a user lets an agent do in one organization: the CLI, an MCP server,
 * anything that signed in through Vectreal's OAuth consent page.
 *
 * Supabase Auth's own scopes (`openid`, `email`, ...) only shape the ID token
 * and gate nothing, so these are Vectreal's, chosen on the consent page and
 * stored on the user's `agent_grants` row. The Postgres enum reads this list,
 * so adding a scope is a migration, and its label below is a total record,
 * so it does not compile until the consent page has a name for it. What it
 * lets an agent do is derived from `AGENT_OPERATION_SCOPES`.
 *
 * Nothing here can delete. An agent that can publish but never destroy is a
 * much smaller blast radius, and deleting stays in the dashboard.
 */
export const AGENT_SCOPES = [
	'projects:read',
	'projects:write',
	'scenes:write',
	'scenes:publish',
	'embed:manage'
] as const

export type AgentScope = (typeof AGENT_SCOPES)[number]

/** Granted on every approval: an agent that cannot see anything is useless. */
export const REQUIRED_AGENT_SCOPES: readonly AgentScope[] = ['projects:read']

const AGENT_SCOPE_LABELS: Record<AgentScope, string> = {
	'projects:read': 'Read projects and scenes',
	'projects:write': 'Create projects and scenes',
	'scenes:write': 'Edit scene settings',
	'scenes:publish': 'Publish scenes',
	'embed:manage': 'Manage embeds'
}

/**
 * Consent page copy: a label, and what the user is agreeing to. The sentence
 * is derived from `AGENT_OPERATION_SCOPES`, so it lists exactly what the scope
 * grants and nothing it does not.
 */
export const AGENT_SCOPE_DESCRIPTIONS = Object.fromEntries(
	AGENT_SCOPES.map((scope) => [
		scope,
		{ label: AGENT_SCOPE_LABELS[scope], description: describeAgentScope(scope) }
	])
) as Record<AgentScope, { label: string; description: string }>

export function isAgentScope(value: string): value is AgentScope {
	return (AGENT_SCOPES as readonly string[]).includes(value)
}

/**
 * The scopes a consent form granted, in canonical order with the required
 * ones always included, or `null` when any submitted value is not a scope.
 * A forged value is refused outright rather than dropped, so a grant never
 * quietly differs from what the form claimed.
 */
export function parseGrantedScopes(
	submitted: readonly string[]
): AgentScope[] | null {
	if (!submitted.every(isAgentScope)) {
		return null
	}

	const granted = new Set<AgentScope>([...REQUIRED_AGENT_SCOPES, ...submitted])
	return AGENT_SCOPES.filter((scope) => granted.has(scope))
}
