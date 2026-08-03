/**
 * The single source of truth for "which organization role may do what" in the
 * dashboard.
 *
 * This module is deliberately pure and client-safe. Route components need it to
 * decide whether to render a Delete affordance; repositories and the mutation
 * endpoint need it to enforce. Before this existed the same question was
 * answered in four places that had already drifted apart - TypeScript
 * predicates in a `.server.ts` file a component could not import, inline
 * `.includes(role)` throws scattered across four repositories, Postgres RLS
 * predicates, and booleans recomputed inside route components.
 *
 * Note that RLS is *not* a runtime backstop here: `db/client.ts` connects with
 * a plain connection string and no `set local role`, so `auth.uid()` is null
 * and every policy in `db/schema/` is inert for application traffic. What this
 * table says is what actually happens.
 */

export type MembershipRole = 'owner' | 'admin' | 'member'

export type DashboardEntityType = 'project' | 'folder' | 'scene'

export type DashboardOperation =
	| 'project:create'
	| 'project:update'
	| 'project:delete'
	| 'scene-folder:create'
	| 'scene-folder:update'
	| 'scene-folder:move'
	| 'scene-folder:delete'
	| 'scene:update'
	| 'scene:move'
	| 'scene:delete'
	| 'organization:update'
	| 'organization:delete'
	| 'organization-member:invite'
	| 'organization-member:update'
	| 'organization-member:remove'
	| 'api-key:create'
	| 'api-key:read'
	| 'api-key:update'
	| 'api-key:revoke'

/**
 * Operations a folder's creator may perform on it regardless of their role.
 *
 * This mirrors the `scene_folders_update_owner_or_admin` and
 * `scene_folders_delete_owner_or_admin` policies, which are
 * `canManageSceneFolder(id) or isUserSelf(owner_id)`. Without it, tightening
 * folder deletion to owner|admin would strand members: they can create a
 * folder and then be unable to remove it.
 *
 * Modelled as a set of operations rather than a fourth role, because "creator"
 * is a property of one resource, not of the membership.
 */
const RESOURCE_OWNER_OPERATIONS: ReadonlySet<DashboardOperation> = new Set([
	'scene-folder:update',
	'scene-folder:move',
	'scene-folder:delete'
])

/**
 * Role -> operation table.
 *
 * Declared as a total `Record` so that adding a `DashboardOperation` without
 * giving it a rule is a compile error rather than a silent denial.
 */
export const DASHBOARD_OPERATION_ROLES: Record<
	DashboardOperation,
	readonly MembershipRole[]
> = {
	'project:create': ['owner', 'admin', 'member'],
	'project:update': ['owner', 'admin'],
	/**
	 * Owner-only, which diverges from the `canManageProject` RLS predicate
	 * (owner|admin). The divergence is deliberate and inert - see the module
	 * comment on RLS - and deleting a project cascades every scene, folder and
	 * published embed beneath it, so the stricter of the two rules wins.
	 */
	'project:delete': ['owner'],

	'scene-folder:create': ['owner', 'admin', 'member'],
	'scene-folder:update': ['owner', 'admin'],
	'scene-folder:move': ['owner', 'admin', 'member'],
	'scene-folder:delete': ['owner', 'admin'],

	'scene:update': ['owner', 'admin', 'member'],
	/** Moving is reorganization, not destruction - members organize their own work. */
	'scene:move': ['owner', 'admin', 'member'],
	'scene:delete': ['owner', 'admin'],

	'organization:update': ['owner', 'admin'],
	'organization:delete': ['owner'],

	'organization-member:invite': ['owner', 'admin'],
	'organization-member:update': ['owner', 'admin'],
	'organization-member:remove': ['owner', 'admin'],

	'api-key:create': ['owner', 'admin'],
	'api-key:read': ['owner', 'admin'],
	'api-key:update': ['owner', 'admin'],
	'api-key:revoke': ['owner', 'admin']
}

export interface DashboardActorContext {
	role: MembershipRole
	/**
	 * True when the actor created the resource being acted on. Only consulted
	 * for the operations in `RESOURCE_OWNER_OPERATIONS`.
	 */
	isResourceOwner?: boolean
}

export function canPerformDashboardOperation(
	operation: DashboardOperation,
	actor: DashboardActorContext
): boolean {
	if (DASHBOARD_OPERATION_ROLES[operation].includes(actor.role)) {
		return true
	}

	return (
		Boolean(actor.isResourceOwner) && RESOURCE_OWNER_OPERATIONS.has(operation)
	)
}

/** Thrown by `assertDashboardPermission`; carries the operation for logging. */
export class DashboardPermissionError extends Error {
	readonly operation: DashboardOperation
	readonly role: MembershipRole

	constructor(operation: DashboardOperation, role: MembershipRole) {
		super(describeDashboardOperationDenial(operation, role))
		this.name = 'DashboardPermissionError'
		this.operation = operation
		this.role = role
	}
}

const OPERATION_SUBJECTS: Record<DashboardOperation, string> = {
	'project:create': 'create projects',
	'project:update': 'edit this project',
	'project:delete': 'delete this project',
	'scene-folder:create': 'create folders',
	'scene-folder:update': 'rename this folder',
	'scene-folder:move': 'move this folder',
	'scene-folder:delete': 'delete this folder',
	'scene:update': 'edit this scene',
	'scene:move': 'move this scene',
	'scene:delete': 'delete this scene',
	'organization:update': 'edit this organization',
	'organization:delete': 'delete this organization',
	'organization-member:invite': 'invite members',
	'organization-member:update': 'change member roles',
	'organization-member:remove': 'remove members',
	'api-key:create': 'create API keys',
	'api-key:read': 'view API keys',
	'api-key:update': 'edit API keys',
	'api-key:revoke': 'revoke API keys'
}

/**
 * User-facing reason a role cannot perform an operation.
 *
 * Lives next to the table so the copy cannot drift from the rule. Surfaced in
 * disabled-affordance tooltips as well as in thrown errors - a disabled button
 * with no explanation is the failure this replaces.
 */
export function describeDashboardOperationDenial(
	operation: DashboardOperation,
	role: MembershipRole
): string {
	const allowed = DASHBOARD_OPERATION_ROLES[operation]
	const who =
		allowed.length === 1 && allowed[0] === 'owner'
			? 'Only organization owners'
			: 'Only organization owners and admins'

	return `${who} can ${OPERATION_SUBJECTS[operation]}. Your role is ${role}.`
}

/** The delete operation for a given entity type. */
export function deleteOperationFor(
	entityType: DashboardEntityType
): DashboardOperation {
	switch (entityType) {
		case 'project':
			return 'project:delete'
		case 'folder':
			return 'scene-folder:delete'
		case 'scene':
			return 'scene:delete'
	}
}

/** The rename operation for a given entity type. */
export function renameOperationFor(
	entityType: DashboardEntityType
): DashboardOperation {
	switch (entityType) {
		case 'project':
			return 'project:update'
		case 'folder':
			return 'scene-folder:update'
		case 'scene':
			return 'scene:update'
	}
}

/**
 * The move operation for a given entity type.
 *
 * Projects have no parent, so they have no move operation - callers must
 * exclude them before reaching here.
 */
export function moveOperationFor(
	entityType: Exclude<DashboardEntityType, 'project'>
): DashboardOperation {
	return entityType === 'folder' ? 'scene-folder:move' : 'scene:move'
}
