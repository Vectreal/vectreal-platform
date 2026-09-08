import { describe, expect, it } from 'vitest'

import { PLAN_LIMITS, type LimitKey, type Plan } from './plan-config'

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
