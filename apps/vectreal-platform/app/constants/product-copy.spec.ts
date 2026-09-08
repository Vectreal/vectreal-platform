import { describe, expect, it } from 'vitest'

import { PLAN_ENTITLEMENTS } from './plan-config'
import {
	ANNUAL_DISCOUNT_CLAIM,
	ENTITLEMENT_FEATURE_GROUPS,
	PLAN_FALLBACK_PRICES,
	PLAN_OFFER_DESCRIPTIONS
} from './product-copy'

/**
 * The four offer descriptions, pinned whole.
 *
 * Nothing guarded these numbers before. The `present` claims over
 * `plan-config.ts` pin `storage_bytes_per_scene` and `api_keys_per_org`, which
 * these sentences never mention, and a claim is a whole-file substring test
 * anyway: it pins a multiset of literals, never a mapping from plan to value.
 * The numbers are read from `PLAN_LIMITS` now, so the mapping cannot be wrong,
 * and this is the first thing that has ever asserted the sentences themselves.
 *
 * Without it, reading them from the config would rewrite published copy in
 * silence - these four strings are the `description` of every schema.org
 * `Offer` and the whole `## Pricing` section of `/llms.txt`. So the red is the
 * point, and the instruction sits in the assertion message rather than up here,
 * because that is what a person sees at the moment they update the string.
 *
 * It pins numbers, not meaning. Free's sentence advertises community support
 * and Pro's says the feature set otherwise matches Free; both are entitlement
 * claims, and flipping the entitlements behind them leaves this green.
 *
 * These are byte-identical to the hand-written strings they replaced.
 */
describe('PLAN_OFFER_DESCRIPTIONS', () => {
	it('states the plan numbers the config holds', () => {
		expect(
			PLAN_OFFER_DESCRIPTIONS,
			'A plan number moved. The sentence below already carries the new number, because it reads PLAN_LIMITS - so read the whole sentence before updating this string. The claim wrapped around the number may no longer be true.'
		).toEqual({
			free: '10 scenes, 500 MB storage, 3 concurrent published scenes. API access and community support included. Embedded scenes carry a small Vectreal badge. No credit card required.',
			pro: '200 scenes, 10 GB storage, 50 concurrent published scenes, 20 projects. Removes the Vectreal badge from embedded scenes; otherwise the feature set matches Free.',
			business:
				'2,000 scenes, 100 GB storage, 500 concurrent published scenes. Adds team collaboration with role-based access (up to 10 seats) and priority support.',
			enterprise:
				'Unlimited scenes, published scenes, projects and seats, with storage sized to your needs. Adds a dedicated support channel. Custom pricing via sales.'
		})
	})
})

describe('claims the copy makes about the plans', () => {
	it('states the discount the current prices give, as a literal', () => {
		/*
		  A literal, deliberately, and this is the second attempt.

		  The first version recomputed the discount from PLAN_FALLBACK_PRICES and
		  compared it to ANNUAL_DISCOUNT_CLAIM - which is itself computed from
		  PLAN_FALLBACK_PRICES. Both sides moved together, so changing a price
		  left the test green: a tautology, caught only by mutating the price and
		  watching nothing go red.

		  Pinning the rendered string means a price change fails here and someone
		  has to update a published marketing claim on purpose. That is the point:
		  the derivation keeps the badge honest automatically, and this keeps the
		  change visible.
		*/
		expect(ANNUAL_DISCOUNT_CLAIM).toBe('Save up to 21%')
	})

	it('never claims less than a plan actually saves', () => {
		// "up to" has to be an upper bound. The old hand-written "20%" was not:
		// Pro saves 21%, so the badge understated its own best case.
		const best = Math.max(
			...Object.values(PLAN_FALLBACK_PRICES).map(({ monthly, annualMonthly }) =>
				Math.round((1 - annualMonthly / monthly) * 100)
			)
		)
		const claimed = Number(ANNUAL_DISCOUNT_CLAIM.match(/(\d+)%/)?.[1])

		expect(claimed).toBeGreaterThanOrEqual(best)
	})

	it('shows every entitlement in the comparison grid', () => {
		/*
		  PRICING_PAGE_COPY.comparisonDescription says "Every entitlement, across
		  all four plans". ENTITLEMENT_FEATURE_GROUPS is a plain array rather than
		  a total Record, so an eighteenth entitlement key compiles cleanly and
		  makes that sentence false with nothing going red. This is the guard the
		  type cannot give.
		*/
		const grouped = new Set(
			ENTITLEMENT_FEATURE_GROUPS.flatMap((group) =>
				group.features.map((feature) => feature.key)
			)
		)
		const declared = Object.keys(PLAN_ENTITLEMENTS.free) as Array<
			keyof typeof PLAN_ENTITLEMENTS.free
		>

		expect([...grouped].sort()).toEqual([...declared].sort())
	})
})
