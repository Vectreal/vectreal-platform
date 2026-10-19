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
 * Nothing destructive is grantable: an agent that can publish but never
 * delete is a much smaller blast radius, and deleting stays in the dashboard.
 * What the agent may then do is still the intersection with the user's role
 * in the organization, through the dashboard operation table.
 */
export const AGENT_OPERATION_SCOPES = {
	'project:create': 'projects:write',
	'project:update': 'projects:write',
	'project:delete': null,
	'scene-folder:create': 'projects:write',
	'scene-folder:update': 'projects:write',
	'scene-folder:move': 'projects:write',
	'scene-folder:delete': null,
	'scene:update': 'scenes:write',
	'scene:move': 'projects:write',
	'scene:delete': null,
	'organization:update': null,
	'organization:delete': null,
	'organization-member:invite': null,
	'organization-member:update': null,
	'organization-member:remove': null,
	'api-key:create': 'embed:manage',
	'api-key:read': 'embed:manage',
	'api-key:update': 'embed:manage',
	'api-key:revoke': 'embed:manage',
	'api-key:rotate': 'embed:manage',
	'billing:manage': null
} as const satisfies Record<DashboardOperation, AgentScope | null>
