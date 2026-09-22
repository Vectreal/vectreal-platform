import { describe, expect, it } from 'vitest'

import {
	ALL_BILLING_STATES,
	getPurchasableUpgrade,
	PLAN_LIMITS,
	RECOMMENDED_UPGRADE,
	type LimitKey,
	type Plan
} from './plan-config'

/**
 * The plan ladder, asserted as a mapping rather than as a set of literals.
 *
 * Two published pages and the four plan descriptions hardcode these numbers.
 * (The plan cards on `/pricing` and on the upgrade route state them too, but
 * render them from the config, so they cannot drift.) `upload.mdx` and
 * `04_api-keys-101.mdx` each carry a claims block pinning the literals they
 * quote; `PLAN_OFFER_DESCRIPTIONS`, which reaches schema.org and `/llms.txt`,
 * is pinned by nothing at all. And a claim can only prove that a literal
 * appears somewhere in `plan-config.ts` - never which plan owns it. Exchange
 * Free's two API keys with Business's fifty and all four `api_keys_per_org`
 * claims stay green while the article publishes both numbers against the wrong
 * plans. Verified before this file existed: that swap left the whole suite
 * green.
 *
 * A higher plan may match the plan below it - Free and Pro both get one seat -
 * but it may never offer less. That is the property a literal cannot express.
 * Ordering is all it expresses, though: exchange Free's ten scenes with its
 * twenty-five folders and nothing inverts, so that swap still passes.
 */

/*
	Written out here, deliberately, and never `ALL_PLANS`.

	The first assertion below compares this list against `Object.keys(PLAN_LIMITS)`.
	Sourcing both sides from the owner would make that comparison an identity and
	it could never fail, which is the one thing this file exists to prevent. The
	guard in `tests/purchasable-plans.spec.ts` does not reach here - its walker
	skips `*.spec.*` - so nothing pushes this toward the owner either.
*/
const PLAN_LADDER: readonly Plan[] = ['free', 'pro', 'business', 'enterprise']

/** `null` is "unlimited" or "custom", so it is the top of the ladder, not zero. */
function asBound(value: number | null): number {
	return value === null ? Number.POSITIVE_INFINITY : value
}

/*
	Read from the config rather than typed out, so a limit added tomorrow is
	covered without an edit here, and a limit deleted cannot leave a stale row.
*/
const LIMIT_KEYS = Object.keys(PLAN_LIMITS.free) as LimitKey[]

describe('the plan ladder', () => {
	it('places every plan exactly once', () => {
		expect([...PLAN_LADDER].sort()).toEqual(Object.keys(PLAN_LIMITS).sort())
	})

	/*
		The key list is read off `free` and then cast, so every other plan is taken
		on trust. Today the `Record<Plan, Record<LimitKey, number | null>>`
		annotation makes a missing key a compile error - but if that annotation ever
		weakens, a plan short of a key would read `undefined`, compare false in both
		directions, and drop that limit out of the ladder test while reporting clean.
	*/
	it('compares the same limits on every plan', () => {
		expect(LIMIT_KEYS.length).toBeGreaterThan(0)

		for (const plan of PLAN_LADDER) {
			expect(Object.keys(PLAN_LIMITS[plan]).sort()).toEqual(
				[...LIMIT_KEYS].sort()
			)
		}
	})

	/*
		The same silent drop, reachable without weakening anything: NaN satisfies
		`number`, so the annotation and tsc both accept it, and it compares false in
		every direction. A limit holding one would sit out the ladder test with its
		key present and the suite green.

		The safe-integer half is `toSafeNumberFromBigInt`'s, because the same limit
		arriving from an `org_limit_overrides` row has to clear it, and a hardcoded
		baseline should not be held to less than a value out of the database. The
		`>= 0` half is this file's own, and it is the one that reaches the ends of
		the ladder, where nothing sits above or below to compare against: a negative
		on Free refuses every operation forever, because `assertWithinQuota` can
		never satisfy `current + adds <= limit`. A fraction is the quieter case - it
		vanishes into the division on a storage key, and publishes "10.5" scenes on
		the plan cards for a count.
	*/
	it('holds a usable value for every limit', () => {
		const unusable = PLAN_LADDER.flatMap((plan) =>
			LIMIT_KEYS.filter((key) => {
				const value = PLAN_LIMITS[plan][key]
				return value !== null && !(Number.isSafeInteger(value) && value >= 0)
			}).map((key) => `${plan}.${key}=${PLAN_LIMITS[plan][key]}`)
		)

		expect(unusable).toEqual([])
	})

	it('never lets a plan offer less than the plan below it', () => {
		const inversions = LIMIT_KEYS.flatMap((key) =>
			PLAN_LADDER.slice(1)
				.map((higher, index) => [PLAN_LADDER[index], higher] as const)
				.filter(
					([lower, higher]) =>
						asBound(PLAN_LIMITS[higher][key]) < asBound(PLAN_LIMITS[lower][key])
				)
				.map(
					([lower, higher]) =>
						`${key}: ${lower}=${PLAN_LIMITS[lower][key]} > ${higher}=${PLAN_LIMITS[higher][key]}`
				)
		)

		expect(inversions).toEqual([])
	})
})

/**
 * Where each plan points next, and which of those a reader can actually buy.
 *
 * Two questions that look like one, which is how they came to be answered by
 * two maps that disagreed at Business. `RECOMMENDED_UPGRADE` is the whole
 * ladder and names Enterprise; `getPurchasableUpgrade` stops where checkout
 * does. Every quota refusal the server raises carries a plan from the first,
 * and every upgrade button a page draws comes from the second.
 *
 * Expectations are literals. Deriving them from the map under test would pass
 * for any contents of it.
 */
describe('the upgrade ladder', () => {
	it('points each plan at the next one up, and enterprise at nothing', () => {
		expect(RECOMMENDED_UPGRADE).toEqual({
			free: 'pro',
			pro: 'business',
			business: 'enterprise',
			enterprise: null
		})
	})

	/*
	  The load-bearing row is Business. Its next plan is Enterprise, which
	  checkout cannot sell, so the honest answer for a purchasable upgrade is
	  nothing - the reader is sent to a conversation rather than to a checkout
	  that would refuse them. The billing page's button used to read
	  `plan === 'pro' ? 'business' : 'pro'`, which offered Business a downgrade
	  to Pro.
	*/
	it('offers nothing to buy above Business', () => {
		expect(getPurchasableUpgrade('free')).toBe('pro')
		expect(getPurchasableUpgrade('pro')).toBe('business')
		expect(getPurchasableUpgrade('business')).toBeNull()
		expect(getPurchasableUpgrade('enterprise')).toBeNull()
	})

	/*
	  Every step is upward. A ladder whose entries pointed sideways or down
	  would still be a total record and would still typecheck; this is what
	  notices.
	*/
	it('never points at a plan below the one it is for', () => {
		for (const plan of PLAN_LADDER) {
			const next = RECOMMENDED_UPGRADE[plan]
			if (next === null) continue

			expect(PLAN_LADDER.indexOf(next)).toBeGreaterThan(
				PLAN_LADDER.indexOf(plan)
			)
		}
	})
})

/**
 * Every billing state, in the order the Postgres enum declares them.
 *
 * Written out rather than read from `ALL_BILLING_STATES`, for the reason
 * `PLAN_LADDER` above is: an expectation taken from the value it checks cannot
 * disagree with it. `billingStateEnum` reads the owner, so the order here is
 * the order of a Postgres type and reordering it is a migration, not an edit.
 */
describe('the billing states', () => {
	it('lists all nine, in the order the database declares', () => {
		expect([...ALL_BILLING_STATES]).toEqual([
			'none',
			'trialing',
			'active',
			'past_due',
			'unpaid',
			'canceled',
			'paused',
			'incomplete',
			'incomplete_expired'
		])
	})

	it('cannot be mutated by a caller', () => {
		expect(Object.isFrozen(ALL_BILLING_STATES)).toBe(true)
	})
})
