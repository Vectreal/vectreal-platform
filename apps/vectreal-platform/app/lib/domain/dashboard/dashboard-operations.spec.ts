import {
	canPerformDashboardOperation,
	DASHBOARD_OPERATION_ROLES,
	deleteOperationFor,
	describeDashboardOperationDenial,
	moveOperationFor,
	renameOperationFor,
	type DashboardOperation,
	type MembershipRole
} from './dashboard-operations'

const ROLES: MembershipRole[] = ['owner', 'admin', 'member']

/**
 * The expected matrix, written out longhand rather than derived from the table
 * under test. A test that recomputes the implementation proves nothing; this
 * one fails if a rule is loosened by accident.
 */
const EXPECTED: Record<DashboardOperation, MembershipRole[]> = {
	'project:create': ['owner', 'admin', 'member'],
	'project:update': ['owner', 'admin'],
	'project:delete': ['owner'],
	'scene-folder:create': ['owner', 'admin', 'member'],
	'scene-folder:update': ['owner', 'admin'],
	'scene-folder:move': ['owner', 'admin', 'member'],
	'scene-folder:delete': ['owner', 'admin'],
	'scene:update': ['owner', 'admin', 'member'],
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
	'api-key:revoke': ['owner', 'admin'],
	'api-key:rotate': ['owner', 'admin']
}

describe('dashboard operation permissions', () => {
	it('covers every declared operation and nothing more', () => {
		expect(Object.keys(DASHBOARD_OPERATION_ROLES).sort()).toEqual(
			Object.keys(EXPECTED).sort()
		)
	})

	it('matches the expected role matrix', () => {
		for (const operation of Object.keys(EXPECTED) as DashboardOperation[]) {
			for (const role of ROLES) {
				expect(
					canPerformDashboardOperation(operation, { role }),
					`${operation} / ${role}`
				).toBe(EXPECTED[operation].includes(role))
			}
		}
	})

	describe('the tightening this change introduces', () => {
		it('denies scene deletion to members', () => {
			expect(
				canPerformDashboardOperation('scene:delete', { role: 'member' })
			).toBe(false)
		})

		it('denies folder deletion to members who did not create the folder', () => {
			expect(
				canPerformDashboardOperation('scene-folder:delete', {
					role: 'member',
					isResourceOwner: false
				})
			).toBe(false)
		})

		it('still lets members delete a folder they created', () => {
			expect(
				canPerformDashboardOperation('scene-folder:delete', {
					role: 'member',
					isResourceOwner: true
				})
			).toBe(true)
		})

		it('does not let the creator override leak to other operations', () => {
			expect(
				canPerformDashboardOperation('scene:delete', {
					role: 'member',
					isResourceOwner: true
				})
			).toBe(false)
			expect(
				canPerformDashboardOperation('project:delete', {
					role: 'admin',
					isResourceOwner: true
				})
			).toBe(false)
		})
	})

	describe('what stays unchanged', () => {
		it('keeps project deletion owner-only, diverging from RLS on purpose', () => {
			expect(
				canPerformDashboardOperation('project:delete', { role: 'admin' })
			).toBe(false)
			expect(
				canPerformDashboardOperation('project:delete', { role: 'owner' })
			).toBe(true)
		})

		it('still lets members edit and move scenes', () => {
			expect(
				canPerformDashboardOperation('scene:update', { role: 'member' })
			).toBe(true)
			expect(
				canPerformDashboardOperation('scene:move', { role: 'member' })
			).toBe(true)
		})
	})

	describe('operation lookups', () => {
		it('maps entity types to their delete operation', () => {
			expect(deleteOperationFor('project')).toBe('project:delete')
			expect(deleteOperationFor('folder')).toBe('scene-folder:delete')
			expect(deleteOperationFor('scene')).toBe('scene:delete')
		})

		it('maps entity types to their rename operation', () => {
			expect(renameOperationFor('project')).toBe('project:update')
			expect(renameOperationFor('folder')).toBe('scene-folder:update')
			expect(renameOperationFor('scene')).toBe('scene:update')
		})

		it('maps movable entity types to their move operation', () => {
			expect(moveOperationFor('folder')).toBe('scene-folder:move')
			expect(moveOperationFor('scene')).toBe('scene:move')
		})
	})

	describe('denial copy', () => {
		it('names owners only for owner-only operations', () => {
			expect(describeDashboardOperationDenial('project:delete', 'admin')).toBe(
				'Only organization owners can delete this project. Your role is admin.'
			)
		})

		it('names owners and admins otherwise', () => {
			expect(describeDashboardOperationDenial('scene:delete', 'member')).toBe(
				'Only organization owners and admins can delete this scene. Your role is member.'
			)
		})
	})
})
