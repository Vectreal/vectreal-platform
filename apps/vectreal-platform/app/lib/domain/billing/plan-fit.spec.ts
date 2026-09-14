/**
 * Whether the billing page says this plan still fits.
 *
 * The rule under test is a relevance rule, so both directions matter equally:
 * a reading under pressure has to appear, and a reading with room has to stay
 * off the page. A version that showed everything would pass any test that only
 * checked the first.
 */

import { describe, expect, it } from 'vitest'

import { describePlanFit } from './plan-fit'

import type { OrgUsage } from '../dashboard/dashboard-types'

const MB = 1024 * 1024

/** A free organization on its first day: one project, nothing else. */
const NEW_FREE_ORG: OrgUsage = {
	projectsTotal: 1,
	projectsLimit: 1,
	scenesTotal: 0,
	sceneLimit: 10,
	publishedScenes: 0,
	publishedSceneLimit: 3,
	foldersTotal: 0,
	foldersLimit: 25,
	storageBytesTotal: 0,
	storageLimit: 500 * MB
}

describe('a free organization using its one project', () => {
	it('names projects, and only projects', () => {
		/*
		  This is every organization in production: `projects_total` is 1 on free
		  and `initializeUserDefaults` creates one at signup. The other four
		  readings are empty, so a page listing all five would be four rows of
		  zero around the one that matters.
		*/
		const fit = describePlanFit(NEW_FREE_ORG, 'free')

		expect(fit.rows.map((row) => row.key)).toEqual(['projects_total'])
	})

	it('says what the next plan does about it', () => {
		const [projects] = describePlanFit(NEW_FREE_ORG, 'free').rows

		expect(projects.usedLabel).toBe('1')
		expect(projects.limitLabel).toBe('1')
		expect(projects.nextLimitLabel).toBe('20')
		expect(projects.atLimit).toBe(true)
	})

	it('gives no all-clear sentence while a row is on screen', () => {
		/*
		  The two would contradict each other: "Free covers what you are using"
		  directly above a row saying projects are full.
		*/
		expect(describePlanFit(NEW_FREE_ORG, 'free').headline).toBeNull()
	})
})

describe('an organization with room', () => {
	const ROOMY: OrgUsage = {
		...NEW_FREE_ORG,
		projectsTotal: 5,
		projectsLimit: 20,
		scenesTotal: 12,
		sceneLimit: 200,
		storageBytesTotal: 900 * MB,
		storageLimit: 10_240 * MB
	}

	it('shows nothing, and says so', () => {
		const fit = describePlanFit(ROOMY, 'pro')

		expect(fit.rows).toEqual([])
		expect(fit.headline).toBe('Pro covers what you are using.')
	})
})

describe('the threshold', () => {
	it('reports a reading that is close but not yet full', () => {
		const fit = describePlanFit(
			{ ...NEW_FREE_ORG, scenesTotal: 8, sceneLimit: 10 },
			'free'
		)

		const scenes = fit.rows.find((row) => row.key === 'scenes_total')
		expect(scenes).toBeDefined()
		expect(scenes?.atLimit).toBe(false)
	})

	it('leaves a reading below it alone', () => {
		/*
		  Both sides of 80% asserted. A rule that reported everything would
		  satisfy the test above on its own.
		*/
		const fit = describePlanFit(
			{ ...NEW_FREE_ORG, scenesTotal: 7, sceneLimit: 10 },
			'free'
		)

		expect(fit.rows.map((row) => row.key)).not.toContain('scenes_total')
	})
})

describe('storage', () => {
	it('reads in the units a person uses, on both sides', () => {
		/*
		  Bytes are counted raw and formatted by `formatLimitValue`, which crosses
		  to GB at a gigabyte. Formatting one side and not the other is how a bar
		  comes to read full at a fraction of its limit.
		*/
		const [storage] = describePlanFit(
			{
				...NEW_FREE_ORG,
				projectsTotal: 0,
				storageBytesTotal: 460 * MB,
				storageLimit: 500 * MB
			},
			'free'
		).rows

		expect(storage.key).toBe('storage_bytes_total')
		expect(storage.usedLabel).toBe('460 MB')
		expect(storage.limitLabel).toBe('500 MB')
		expect(storage.nextLimitLabel).toBe('10 GB')
	})
})

describe('a plan with nothing above it', () => {
	it('offers Business no next plan, and no next number', () => {
		/*
		  Enterprise is a conversation rather than a checkout. The rows still
		  report the pressure; there is simply no upgrade column to fill.
		*/
		const fit = describePlanFit(
			{ ...NEW_FREE_ORG, projectsTotal: 200, projectsLimit: 200 },
			'business'
		)

		expect(fit.nextPlan).toBeNull()
		expect(fit.nextPlanLabel).toBeNull()
		expect(fit.rows[0].nextLimitLabel).toBeNull()
	})

	it('never offers a plan below the one held', () => {
		/*
		  `plan === 'pro' ? 'business' : 'pro'` sent Business to Pro. Asserted as
		  a literal rather than derived from the map, so replacing the map with
		  the ternary goes red.
		*/
		expect(describePlanFit(NEW_FREE_ORG, 'business').nextPlan).toBeNull()
		expect(describePlanFit(NEW_FREE_ORG, 'pro').nextPlan).toBe('business')
		expect(describePlanFit(NEW_FREE_ORG, 'free').nextPlan).toBe('pro')
	})
})

describe('an unlimited plan', () => {
	it('always fits, and divides by no zero', () => {
		const fit = describePlanFit(
			{
				projectsTotal: 900,
				projectsLimit: null,
				scenesTotal: 900,
				sceneLimit: null,
				publishedScenes: 900,
				publishedSceneLimit: null,
				foldersTotal: 900,
				foldersLimit: null,
				storageBytesTotal: 900 * MB,
				storageLimit: null
			},
			'enterprise'
		)

		expect(fit.rows).toEqual([])
		expect(fit.headline).toBe('Enterprise covers what you are using.')
	})
})
