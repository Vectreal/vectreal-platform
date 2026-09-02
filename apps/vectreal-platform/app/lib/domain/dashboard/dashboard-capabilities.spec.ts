import {
	buildDashboardCapabilities
} from './dashboard-capabilities'

const OWNED_ORG = 'org-owned'
const MEMBER_ORG = 'org-member'

const MEMBERSHIPS = [
	{ organization: { id: OWNED_ORG }, membership: { role: 'owner' as const } },
	{ organization: { id: MEMBER_ORG }, membership: { role: 'member' as const } }
]

describe('dashboard capabilities', () => {
	it('derives per-organization booleans from the permission table', () => {
		const capabilities = buildDashboardCapabilities(MEMBERSHIPS)

		expect(capabilities[OWNED_ORG]).toMatchObject({
			role: 'owner',
			canCreateProject: true,
			canUpdateProject: true,
			canDeleteProject: true
		})

		expect(capabilities[MEMBER_ORG]).toMatchObject({
			role: 'member',
			canCreateProject: true,
			canUpdateProject: false,
			canDeleteProject: false
		})
	})

	it('defaults quota to unlimited when the loader did not look it up', () => {
		const capabilities = buildDashboardCapabilities(MEMBERSHIPS)

		expect(capabilities[OWNED_ORG]).toMatchObject({
			projectsTotal: 0,
			projectsLimit: null,
			quotaExceeded: false,
			plan: null,
			upgradeTo: null
		})
	})

	describe('quota', () => {
		it('blocks creation when the limit is reached', () => {
			const capabilities = buildDashboardCapabilities(MEMBERSHIPS, {
				[OWNED_ORG]: { projectsTotal: 1, projectsLimit: 1, plan: 'free' }
			})

			expect(capabilities[OWNED_ORG].quotaExceeded).toBe(true)
			expect(capabilities[OWNED_ORG].canCreateProject).toBe(false)
		})

		it('leaves deletion untouched by quota', () => {
			const capabilities = buildDashboardCapabilities(MEMBERSHIPS, {
				[OWNED_ORG]: { projectsTotal: 5, projectsLimit: 1 }
			})

			expect(capabilities[OWNED_ORG].canDeleteProject).toBe(true)
		})

		it('treats a null limit as unlimited', () => {
			const capabilities = buildDashboardCapabilities(MEMBERSHIPS, {
				[OWNED_ORG]: { projectsTotal: 9999, projectsLimit: null }
			})

			expect(capabilities[OWNED_ORG].quotaExceeded).toBe(false)
			expect(capabilities[OWNED_ORG].canCreateProject).toBe(true)
		})

		it('does not apply one organization quota to another', () => {
			const capabilities = buildDashboardCapabilities(MEMBERSHIPS, {
				[OWNED_ORG]: { projectsTotal: 1, projectsLimit: 1 }
			})

			expect(capabilities[MEMBER_ORG].quotaExceeded).toBe(false)
		})
	})

})
