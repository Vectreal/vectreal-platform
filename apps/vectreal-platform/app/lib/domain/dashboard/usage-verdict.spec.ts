import { describe, expect, it } from 'vitest'

import { describeUsageVerdict, type UsageReadingInput } from './usage-verdict'

/**
 * The states a real organization is actually in.
 *
 * Every case here is reachable on a shipped plan, and two of them are the
 * reason this module exists rather than a ternary in the route.
 */

const free = (
	over: Partial<Record<string, number>> = {}
): UsageReadingInput[] => [
	{
		key: 'scenes_total',
		label: 'Scenes',
		current: over.scenes ?? 0,
		limit: 10
	},
	{
		key: 'scenes_published_concurrent',
		label: 'Published scenes',
		current: over.published ?? 0,
		limit: 3
	},
	{
		key: 'projects_total',
		label: 'Projects',
		current: over.projects ?? 1,
		limit: 1
	},
	{
		key: 'folders_total',
		label: 'Folders',
		current: over.folders ?? 0,
		limit: 25
	},
	{
		key: 'storage_bytes_total',
		label: 'Scene storage',
		current: over.storage ?? 0,
		limit: 500
	}
]

describe('describeUsageVerdict', () => {
	/*
		The state every free account is in on day one. `projects_total` is 1 and a
		project is created at signup, so `readUsage(1, 1)` scores critical - and
		the band this page replaced showed a red bar and an upgrade button to every
		new user forever because of it. An account that has stored nothing has
		nothing to act on and is told so.
	*/
	it('does not cry wolf at an account that has stored nothing', () => {
		const verdict = describeUsageVerdict(
			[
				{ key: 'scenes_total', label: 'Scenes', current: 0, limit: 10 },
				// 1, not 0: every account is created with a project at signup, so a
				// fixture at 0 tests a state that cannot exist.
				{ key: 'projects_total', label: 'Projects', current: 1, limit: 1 }
			],
			'Free'
		)

		expect(verdict.tone).toBe('empty')
		expect(verdict.bindingKey).toBeNull()
	})

	/*
		The same account one project in, which is where every free organization
		lives permanently. It is genuinely capped - a second project is refused -
		but nothing about it needs attention, because nothing can be done about it
		and it will read the same tomorrow.

		This had its own `plan` tone and headline, "Free includes one project",
		which meant every free organization was led by a sentence about a fact
		that never changes, whatever the other readings said. The cap is reported
		by its own row instead.
	*/
	it('does not lead with a cap the reader cannot act on', () => {
		// Something stored, so this is not the empty case - the cap is the only
		// full reading and it is still not what the page leads with.
		const verdict = describeUsageVerdict(
			free({ scenes: 6, storage: 121 }),
			'Free'
		)

		expect(verdict.tone).toBe('clear')
		expect(verdict.headline).toBe('Nothing needs your attention.')
		expect(verdict.remedy).toBeNull()
		expect(verdict.bindingKey).toBeNull()
	})

	/*
		The load-bearing ordering. A free organization is always at 1 of 1
		projects, so a verdict that ranked by ratio alone would report that
		forever and bury the storage figure that actually needs attention.
	*/
	it('puts real pressure ahead of the permanent one', () => {
		const verdict = describeUsageVerdict(free({ storage: 480 }), 'Free')

		expect(verdict.tone).toBe('near')
		expect(verdict.bindingKey).toBe('storage_bytes_total')
		expect(verdict.remedy).toMatch(/Optimize the heaviest scene/)
	})

	it('says full rather than close when a limit is reached', () => {
		const verdict = describeUsageVerdict(free({ scenes: 10 }), 'Free')

		expect(verdict.tone).toBe('blocked')
		expect(verdict.headline).toBe('Scenes is full.')
	})

	/*
		The remedy is per limit because the action is. Unpublishing frees a slot
		and keeps the scene, which is the one people get wrong.
	*/
	it('gives each limit the remedy that actually applies to it', () => {
		expect(describeUsageVerdict(free({ published: 3 }), 'Free').remedy).toMatch(
			/Unpublish/
		)
		expect(describeUsageVerdict(free({ folders: 25 }), 'Free').remedy).toMatch(
			/Delete a folder/
		)
	})

	it('has no verdict to give when the plan sets no limits', () => {
		const verdict = describeUsageVerdict(
			[
				{ key: 'scenes_total', label: 'Scenes', current: 4000, limit: null },
				{ key: 'projects_total', label: 'Projects', current: 90, limit: null }
			],
			'Enterprise'
		)

		expect(verdict.tone).toBe('unlimited')
		expect(verdict.remedy).toBeNull()
	})

	it('says so plainly when there is room everywhere', () => {
		const verdict = describeUsageVerdict(
			free({ scenes: 2, storage: 40, projects: 0 }),
			'Free'
		)

		expect(verdict.tone).toBe('clear')
		expect(verdict.bindingKey).toBeNull()
	})
})
