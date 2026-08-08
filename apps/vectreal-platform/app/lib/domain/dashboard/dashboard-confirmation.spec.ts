import {
	DASHBOARD_CONFIRMATION_TOKEN,
	planDeleteConfirmation,
	requiresTypedConfirmation,
	toContentRef,
	toProjectRef,
	toSceneRef,
	TYPED_CONFIRMATION_BULK_THRESHOLD,
	type DashboardEntityRef
} from './dashboard-confirmation'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'

function scene(
	overrides: Partial<DashboardEntityRef> = {}
): DashboardEntityRef {
	return {
		type: 'scene',
		id: 'scene-1',
		name: 'Hero Shot',
		projectId: PROJECT_ID,
		folderId: null,
		sceneStatus: 'draft',
		...overrides
	}
}

function folder(
	overrides: Partial<DashboardEntityRef> = {}
): DashboardEntityRef {
	return {
		type: 'folder',
		id: 'folder-1',
		name: 'Product Shots',
		projectId: PROJECT_ID,
		folderId: null,
		childCount: 0,
		...overrides
	}
}

describe('destructive confirmation tiers', () => {
	describe('scenes', () => {
		it('asks only for acknowledgement on a draft', () => {
			const plan = planDeleteConfirmation([scene()])

			expect(plan.tier).toBe('acknowledge')
			expect(plan.token).toBeNull()
		})

		it('treats an archived scene as low-consequence too', () => {
			expect(
				planDeleteConfirmation([scene({ sceneStatus: 'archived' })]).tier
			).toBe('acknowledge')
		})

		it('demands a typed confirmation for a published scene', () => {
			const plan = planDeleteConfirmation([scene({ sceneStatus: 'published' })])

			expect(plan.tier).toBe('typed')
			expect(plan.token).toBe(DASHBOARD_CONFIRMATION_TOKEN)
		})

		it('tells the user that embeds break and storage is reclaimed', () => {
			const plan = planDeleteConfirmation([scene({ sceneStatus: 'published' })])

			expect(plan.title).toContain('Hero Shot')
			expect(plan.consequences.join(' ')).toContain('embed')
			/*
			  This used to promise only that the published GLB went. Deletion now
			  collects every asset the scene owns, so the copy covers all of them -
			  and says the shared ones stay, because reference-counted cleanup
			  deliberately keeps an upload another scene still uses.
			*/
			expect(plan.consequences.join(' ')).toContain('removed from storage')
			expect(plan.consequences.join(' ')).toContain('unless another scene')
		})

		it('treats an unknown status as not published', () => {
			expect(
				planDeleteConfirmation([scene({ sceneStatus: undefined })]).tier
			).toBe('acknowledge')
		})
	})

	describe('folders', () => {
		it('asks only for acknowledgement when empty', () => {
			expect(planDeleteConfirmation([folder({ childCount: 0 })]).tier).toBe(
				'acknowledge'
			)
		})

		it('demands a typed confirmation when it holds items', () => {
			const plan = planDeleteConfirmation([folder({ childCount: 3 })])

			expect(plan.tier).toBe('typed')
			expect(plan.description).toContain('3 items')
		})

		it('fails closed when the child count is unknown', () => {
			expect(
				planDeleteConfirmation([folder({ childCount: undefined })]).tier
			).toBe('typed')
		})

		it('says scenes survive and subfolders do not', () => {
			const consequences = planDeleteConfirmation([
				folder({ childCount: 2 })
			]).consequences.join(' ')

			expect(consequences).toContain('move to the project root')
			expect(consequences).toContain('Subfolders')
		})
	})

	describe('projects', () => {
		it('always demands a typed confirmation', () => {
			const plan = planDeleteConfirmation([
				toProjectRef({ id: 'p1', name: 'Acme Store' })
			])

			expect(plan.tier).toBe('typed')
			expect(plan.token).toBe(DASHBOARD_CONFIRMATION_TOKEN)
		})

		it('counts the scenes and published scenes it will take with it', () => {
			const plan = planDeleteConfirmation([
				toProjectRef({
					id: 'p1',
					name: 'Acme Store',
					sceneCount: 12,
					counts: { published: 4 }
				})
			])

			expect(plan.consequences[0]).toBe(
				'12 scenes are deleted, including 4 published'
			)
		})

		it('omits the embed warning when nothing is published', () => {
			const plan = planDeleteConfirmation([
				toProjectRef({
					id: 'p1',
					name: 'Quiet Project',
					sceneCount: 3,
					counts: { published: 0 }
				})
			])

			expect(plan.consequences.join(' ')).not.toContain('embed')
		})
	})

	describe('bulk', () => {
		it('stays at acknowledge just below the threshold', () => {
			const refs = Array.from(
				{ length: TYPED_CONFIRMATION_BULK_THRESHOLD - 1 },
				(_unused, index) => scene({ id: `scene-${index}` })
			)

			expect(requiresTypedConfirmation(refs)).toBe(false)
		})

		it('escalates at the threshold', () => {
			const refs = Array.from(
				{ length: TYPED_CONFIRMATION_BULK_THRESHOLD },
				(_unused, index) => scene({ id: `scene-${index}` })
			)

			expect(requiresTypedConfirmation(refs)).toBe(true)
		})

		it('escalates a small batch containing one published scene', () => {
			const plan = planDeleteConfirmation([
				scene({ id: 'a' }),
				scene({ id: 'b', sceneStatus: 'published' })
			])

			expect(plan.tier).toBe('typed')
			expect(plan.consequences.join(' ')).toContain(
				'1 of these scenes is published'
			)
		})

		it('describes a mixed selection by type', () => {
			const plan = planDeleteConfirmation([
				scene({ id: 'a' }),
				scene({ id: 'b' }),
				folder({ id: 'c', childCount: 0 })
			])

			expect(plan.description).toBe('1 folder and 2 scenes.')
		})

		it('never lists more than five consequences', () => {
			const plan = planDeleteConfirmation([
				toProjectRef({
					id: 'p1',
					name: 'Big',
					sceneCount: 40,
					counts: { published: 20 }
				}),
				folder({ childCount: 5 }),
				scene({ sceneStatus: 'published' })
			])

			expect(plan.consequences.length).toBeLessThanOrEqual(5)
			expect(plan.consequences.at(-1)).toBe('This cannot be undone')
		})
	})

	describe('the token', () => {
		it('is the literal DELETE for every typed plan, never the entity name', () => {
			const typedPlans = [
				planDeleteConfirmation([scene({ sceneStatus: 'published' })]),
				planDeleteConfirmation([folder({ childCount: 1 })]),
				planDeleteConfirmation([toProjectRef({ id: 'p', name: 'Acme' })])
			]

			for (const plan of typedPlans) {
				expect(plan.token).toBe('DELETE')
			}
		})
	})

	describe('empty selection', () => {
		it('returns a dead end rather than a live confirm button', () => {
			const plan = planDeleteConfirmation([])

			expect(plan.tier).toBe('typed')
			expect(plan.title).toBe('Nothing selected')
		})
	})

	describe('row mappers', () => {
		it('carries scene status through, which hand-mapping used to drop', () => {
			const ref = toSceneRef({
				id: 's1',
				name: 'Hero',
				projectId: PROJECT_ID,
				status: 'published'
			})

			expect(ref.sceneStatus).toBe('published')
			expect(requiresTypedConfirmation([ref])).toBe(true)
		})

		it('dispatches content rows on their type', () => {
			expect(
				toContentRef({
					type: 'folder',
					id: 'f1',
					name: 'Folder',
					projectId: PROJECT_ID,
					childCount: 2
				}).type
			).toBe('folder')

			expect(
				toContentRef({
					type: 'scene',
					id: 's1',
					name: 'Scene',
					projectId: PROJECT_ID,
					status: 'draft'
				}).type
			).toBe('scene')
		})
	})
})
