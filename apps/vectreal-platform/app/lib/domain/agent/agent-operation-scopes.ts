import type { AgentScope } from './agent-scopes'
import type { DashboardOperation } from '../dashboard/dashboard-operations'

/**
 * Which scope lets an agent perform each dashboard operation, or `null` for an
 * operation no agent may perform at all.
 *
 * Total over `DashboardOperation`, so a new operation does not compile until
 * someone decides whether agents get it. `as const` keeps each value's
 * literal type, so passing a `null` entry to `authorizeAgentRequest` is a
 * compile error rather than a route that can never be called.
 *
 * An operation no `/api/v1` route serves is `null` too, until one does: the
 * consent page lists what a scope allows from this map, so a scope mapped to
 * an operation no route serves promises the user something no agent can do.
 *
 * Nothing destructive is grantable: an agent that can publish but never
 * delete is a much smaller blast radius, and deleting stays in the dashboard.
 * What the agent may then do is still the intersection with the user's role
 * in the organization, through the dashboard operation table.
 */
export const AGENT_OPERATION_SCOPES = {
	'project:read': 'projects:read',
	'project:create': 'projects:write',
	'project:update': null,
	'project-embed-domains:update': 'embed:manage',
	'project:delete': null,
	'scene-folder:create': null,
	'scene-folder:update': null,
	'scene-folder:move': null,
	'scene-folder:delete': null,
	'scene:read': 'projects:read',
	'scene:create': 'projects:write',
	'scene:publish': 'scenes:publish',
	'scene:unpublish': 'scenes:publish',
	'scene:update': 'scenes:write',
	'scene:move': null,
	'scene:delete': null,
	'organization:update': null,
	'organization:delete': null,
	'organization-member:invite': null,
	'organization-member:update': null,
	'organization-member:remove': null,
	'api-key:create': 'embed:manage',
	'api-key:read': 'embed:manage',
	'api-key:update': null,
	'api-key:revoke': null,
	'api-key:rotate': null,
	'billing:manage': null
} as const satisfies Record<DashboardOperation, AgentScope | null>

type GrantedOperation = {
	[
		Operation in keyof typeof AGENT_OPERATION_SCOPES
	]: (typeof AGENT_OPERATION_SCOPES)[Operation] extends null ? never : Operation
}[keyof typeof AGENT_OPERATION_SCOPES]

/**
 * What each operation an agent can be granted lets it do, as the consent page
 * says it. Total over the granted operations, so granting a new one does not
 * compile until it has words, and a scope's description cannot name anything
 * the map does not grant.
 */
const AGENT_OPERATION_PHRASES: Record<GrantedOperation, string> = {
	'project:read': 'list your projects with their scenes',
	'project:create': 'create projects',
	'project-embed-domains:update': 'edit the domains embeds work on',
	'scene:read': "read each scene's settings",
	'scene:create': 'upload a model as a new scene',
	'scene:publish': 'publish scenes',
	'scene:unpublish': 'take them offline again',
	'scene:update': "change a scene's settings",
	'api-key:create': 'create embed keys',
	'api-key:read': 'read their embed snippets'
}

/** One sentence: every operation `scope` grants, in the map's order. */
export function describeAgentScope(scope: AgentScope): string {
	const phrases = (
		Object.entries(AGENT_OPERATION_SCOPES) as [
			keyof typeof AGENT_OPERATION_SCOPES,
			AgentScope | null
		][]
	)
		.filter(([, granted]) => granted === scope)
		.map(
			([operation]) => AGENT_OPERATION_PHRASES[operation as GrantedOperation]
		)

	const list =
		phrases.length > 1
			? `${phrases.slice(0, -1).join(', ')} and ${phrases.at(-1)}`
			: (phrases[0] ?? '')
	return `${list.charAt(0).toUpperCase()}${list.slice(1)}.`
}
