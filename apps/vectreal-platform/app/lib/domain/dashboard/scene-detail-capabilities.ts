import { canPerformDashboardOperation } from './dashboard-operations'

import type { MembershipRole } from './dashboard-operations'

/**
 * The minimum this needs to answer the question.
 *
 * Deliberately structural rather than the `ResolvedMembership` returned by
 * `dashboard-permissions.server.ts`, for the reason `dashboard-capabilities.ts`
 * gives for the same shape beside it: naming that type here would pull a
 * server-only module into something the client renders from.
 */
export interface SceneActorLike {
	role: MembershipRole
}

/**
 * Whether this actor may delete the scene they are looking at.
 *
 * A pure module for one boolean, which is not the usual justification. It is
 * here because a route module cannot be imported by a test - `getDbClient()`
 * runs at module scope and throws `Missing DATABASE_URL` - so the loader's
 * `canDeleteScene` was the one part of the delete gate nothing could reach.
 * Both ends were covered and the wiring between them was not: naming a
 * different operation, or defaulting an absent membership to `true`, broke no
 * test. That is the "the call, not only the rule" case exactly.
 *
 * Absent membership means the actor is in no organization that owns this
 * scene, which is no. It is not a fallback: `getScene` has already 404'd for
 * anything the actor cannot see by the time a loader asks this.
 */
export function canDeleteScene(membership: SceneActorLike | null): boolean {
	if (!membership) {
		return false
	}

	return canPerformDashboardOperation('scene:delete', membership)
}
