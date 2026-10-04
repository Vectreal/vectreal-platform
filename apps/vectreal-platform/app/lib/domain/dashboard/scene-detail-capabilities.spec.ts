import { DASHBOARD_OPERATION_ROLES } from './dashboard-operations'
import { canDeleteScene, canUpdateScene } from './scene-detail-capabilities'

import type { MembershipRole } from './dashboard-operations'

const ROLES: MembershipRole[] = ['owner', 'admin', 'member']

describe('canDeleteScene', () => {
	it('answers with the permission table rather than a rule of its own', () => {
		/*
		  Read from the table, not restated. A hand-written list here would pass
		  while disagreeing with the map the mutation endpoint enforces against -
		  which is the drift this whole module exists to prevent, reproduced in its
		  own test.
		*/
		for (const role of ROLES) {
			expect(canDeleteScene({ role })).toBe(
				DASHBOARD_OPERATION_ROLES['scene:delete'].includes(role)
			)
		}
	})

	it('names the operation the endpoint enforces, not a neighbouring one', () => {
		/*
		  The assertion above is satisfied by any operation whose roles happen to
		  match, so it is anchored to a role that separates them: a member may
		  update and move a scene and may not delete it. Pointing this at
		  `scene:update` reads identically and hands every member a Delete button.
		*/
		expect(canDeleteScene({ role: 'member' })).toBe(false)
		expect(DASHBOARD_OPERATION_ROLES['scene:update']).toContain('member')
	})

	it('refuses an actor with no membership at all', () => {
		/*
		  Absent membership is no membership. Defaulting this to `true` is invisible
		  on every surface an owner ever sees.
		*/
		expect(canDeleteScene(null)).toBe(false)
	})
})

describe('canUpdateScene', () => {
	it('answers with the permission table rather than a rule of its own', () => {
		for (const role of ROLES) {
			expect(canUpdateScene({ role })).toBe(
				DASHBOARD_OPERATION_ROLES['scene:update'].includes(role)
			)
		}
	})

	it('names scene:update, which a member holds and scene:delete does not', () => {
		expect(canUpdateScene({ role: 'member' })).toBe(true)
		expect(DASHBOARD_OPERATION_ROLES['scene:delete']).not.toContain('member')
	})

	it('refuses an actor with no membership at all', () => {
		expect(canUpdateScene(null)).toBe(false)
	})
})
