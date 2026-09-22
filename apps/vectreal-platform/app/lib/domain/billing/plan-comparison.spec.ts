/**
 * What the upgrade page says a plan change would do.
 *
 * Every expectation is a literal. The labels come out of `PLAN_LIMITS` through
 * `formatLimitValue`, and deriving the expected value from the same two would
 * pass for any config at all.
 */

import { describe, expect, it } from 'vitest'

import {
	comparePlans,
	getPlanChangeTargets,
	resolveInitialTarget
} from './plan-comparison'

describe('Free to Pro', () => {
	it('shows only the limits that change', () => {
		/*
		  Both plans allow one seat. A `1 -> 1` row is a row read to learn that it
		  says nothing, which is what the seventeen-row table this replaces was
		  made of.
		*/
		const keys = comparePlans('free', 'pro').rows.map((row) => row.key)

		expect(keys).not.toContain('org_seats')
		expect(keys).toEqual([
			'storage_bytes_total',
			'scenes_total',
			'scenes_published_concurrent',
			'projects_total',
			'folders_total',
			'storage_bytes_per_scene',
			'api_keys_per_org'
		])
	})

	it('reads each limit in the units a person uses', () => {
		const storage = comparePlans('free', 'pro').rows.find(
			(row) => row.key === 'storage_bytes_total'
		)

		expect(storage?.fromLabel).toBe('500 MB')
		expect(storage?.toLabel).toBe('10 GB')
		expect(storage?.change).toBe('raised')
	})

	it('names the one entitlement it adds, and takes none away', () => {
		const comparison = comparePlans('free', 'pro')

		expect(comparison.gained).toEqual(['Remove Vectreal branding'])
		expect(comparison.lost).toEqual([])
		expect(comparison.isReduction).toBe(false)
	})

	it('says nothing is full when nothing is', () => {
		const comparison = comparePlans('free', 'pro')

		expect(comparison.title).toBe('Every limit that changes goes up on Pro.')
		expect(comparison.detail).toBe('Nothing on Free is full yet.')
	})
})

describe('a reader who arrived because something is full', () => {
	it('meets that reading first', () => {
		/*
		  Projects sits fourth in the card order. Someone sent here by "you have
		  used your one project" should not read storage, scenes and published
		  scenes before reaching the reason they came.
		*/
		const comparison = comparePlans('free', 'pro', {
			used: { projects_total: 1 }
		})

		expect(comparison.rows[0].key).toBe('projects_total')
		expect(comparison.rows.map((row) => row.key)).toHaveLength(7)
	})

	it('leads with it', () => {
		const comparison = comparePlans('free', 'pro', {
			used: { projects_total: 1 }
		})

		expect(comparison.title).toBe('No room left for Projects on Free.')
		/* The table beneath says what Pro does about it; a sentence would repeat it. */
		expect(comparison.detail).toBeNull()
	})

	it('says close rather than full when it is close', () => {
		expect(
			comparePlans('free', 'pro', { used: { scenes_total: 8 } }).title
		).toBe('Scenes is close to its limit on Free.')
	})

	it('puts a full limit the usage record does not hold at the top', () => {
		/*
		  API keys sit seventh in the card order and are not one of the five
		  readings `loadOrgUsage` counts. A reader refused a third key has to meet
		  that row first; the title reads fullness separately, so it alone would
		  not notice the row staying seventh.
		*/
		const [lead] = comparePlans('free', 'pro', {
			used: { api_keys_per_org: 2 }
		}).rows

		expect(lead.key).toBe('api_keys_per_org')
		expect(lead.isTight).toBe(true)
	})

	it('names every full reading, not only the first', () => {
		/*
		  A free organization at its one project and its two API keys is blocked
		  twice. The reason used to come from the five readings the usage record
		  holds, which do not include API keys, so a reader refused a key was told
		  only about projects.
		*/
		expect(
			comparePlans('free', 'pro', {
				used: { projects_total: 1, api_keys_per_org: 2 }
			}).title
		).toBe('No room left for Projects and API keys on Free.')
	})
})

describe('what counts as the reason', () => {
	it('does not treat having a figure as being the reason', () => {
		/*
		  Every counted limit has a figure; only the nearly full ones lead. A rule
		  keyed on the figure would make every counted row the headline.
		*/
		const comparison = comparePlans('free', 'pro', {
			used: { scenes_total: 2, folders_total: 3 }
		})

		expect(comparison.rows.every((row) => !row.isTight)).toBe(true)
		expect(comparison.title).toBe('Every limit that changes goes up on Pro.')
	})
})

describe('Business to Pro', () => {
	it('is a reduction, and says so before anything is paid', () => {
		/*
		  The confirmation page learned to say this after the money moved. The
		  dialog before it drew `Business -> Pro` as an ordinary arrow.
		*/
		const comparison = comparePlans('business', 'pro')

		expect(comparison.isReduction).toBe(true)
		expect(comparison.title).toBe('Pro has less room than Business.')
		expect(comparison.lost).toEqual([
			'Multi-member workspace',
			'Role-based access',
			'Priority support'
		])
		expect(comparison.rows.every((row) => row.change === 'lowered')).toBe(true)
	})

	/*
	  The fact a reader cannot get from the table. Business allows 2,000 scenes
	  and Pro allows 200, so an organization holding 500 is comfortable today and
	  over the cap the moment the change goes through - and the change is
	  prorated and immediate.

	  Pressure used to be measured against the plan held, always. 500 of 2,000 is
	  not tight, so every row read as comfortable, the page printed "Pro has less
	  room than Business." and the reader had to do the arithmetic themselves
	  from a row that said `2,000 -> 200`.
	*/
	it('names what is already past the target, before the money moves', () => {
		const comparison = comparePlans('business', 'pro', {
			used: { scenes_total: 500 }
		})

		expect(comparison.title).toBe(
			'Moving to Pro would put Scenes over the limit.'
		)
		expect(
			comparison.rows.find((row) => row.key === 'scenes_total')?.atLimit
		).toBe(true)
	})

	/*
	  And the reading that still fits is not dressed up as a problem: 50 scenes
	  clears Pro's 200 with room, so the plain statement about the plans stands.
	*/
	it('says only that there is less room when everything still fits', () => {
		const comparison = comparePlans('business', 'pro', {
			used: { scenes_total: 50 }
		})

		expect(comparison.title).toBe('Pro has less room than Business.')
		expect(comparison.rows.some((row) => row.atLimit)).toBe(false)
	})
})

describe('where a reader can go from here', () => {
	it('offers what checkout sells, never the plan already held', () => {
		expect(getPlanChangeTargets('free')).toEqual(['pro', 'business'])
		expect(getPlanChangeTargets('pro')).toEqual(['business'])
		expect(getPlanChangeTargets('business')).toEqual(['pro'])
		/*
		  Nothing for enterprise. That plan is a contract invoiced off-platform
		  and carries no Stripe subscription, so a self-serve move down would
		  have opened a second subscription beside it. `/api/billing/checkout`
		  refuses it, and this stops the page drawing a control for a move the
		  server will reject.
		*/
		expect(getPlanChangeTargets('enterprise')).toEqual([])
	})

	it('opens on the plan asked for, when it is one they can move to', () => {
		expect(resolveInitialTarget('free', 'business')).toBe('business')
	})

	it('ignores a request for the plan already held', () => {
		/*
		  `?plan=pro` from a Pro organization - the old billing ternary produced
		  exactly this - falls through to the next plan up.
		*/
		expect(resolveInitialTarget('pro', 'pro')).toBe('business')
	})

	it('opens on the next plan up when nothing was asked for', () => {
		expect(resolveInitialTarget('free', null)).toBe('pro')
		expect(resolveInitialTarget('pro', null)).toBe('business')
	})

	it('places nobody on a downgrade they did not ask for', () => {
		/*
		  A missing parameter used to mean Pro for everyone, so a Business reader
		  arrived with a step down selected. Every plan checkout sells is below
		  Business and below Enterprise, so both open on nothing - and can still
		  reach Pro by choosing it, which the assertion after this covers.
		*/
		expect(resolveInitialTarget('business', null)).toBeNull()
		expect(resolveInitialTarget('enterprise', null)).toBeNull()
		expect(resolveInitialTarget('business', 'pro')).toBe('pro')
	})
})
