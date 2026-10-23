/**
 * What a user lets an agent do in one organization: the CLI, an MCP server,
 * anything that signed in through Vectreal's OAuth consent page.
 *
 * Supabase Auth's own scopes (`openid`, `email`, ...) only shape the ID token
 * and gate nothing, so these are Vectreal's, chosen on the consent page and
 * stored on the user's `agent_grants` row. The Postgres enum reads this list,
 * so adding a scope is a migration, and the descriptions below are a total
 * record, so it does not compile until the consent page has copy for it.
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

/** Consent page copy, one sentence each: what the user is agreeing to. */
export const AGENT_SCOPE_DESCRIPTIONS: Record<
	AgentScope,
	{ label: string; description: string }
> = {
	'projects:read': {
		label: 'Read projects and scenes',
		description: 'See your projects, folders, scenes and their settings.'
	},
	'projects:write': {
		label: 'Create and organize',
		description:
			'Create projects, folders and scenes, including uploading a model as a new scene, and rename or move them.'
	},
	'scenes:write': {
		label: 'Edit scene settings',
		description: 'Change the settings of existing scenes.'
	},
	'scenes:publish': {
		label: 'Publish scenes',
		description: 'Publish scenes and take them offline again.'
	},
	'embed:manage': {
		label: 'Manage embeds',
		description: 'Create embed keys and edit the domains they work on.'
	}
}

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
