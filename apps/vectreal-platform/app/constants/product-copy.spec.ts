import { describe, expect, it } from 'vitest'

import { PLAN_OFFER_DESCRIPTIONS } from './product-copy'

/**
 * The four offer descriptions, pinned whole.
 *
 * Nothing guarded these numbers before. The `present` claims over
 * `plan-config.ts` pinned `storage_bytes_per_scene` and `api_keys_per_org`,
 * which these sentences never mention, and a claim is a whole-file substring
 * test anyway: it pins a multiset of literals, never a mapping from plan to
 * value. All but two are gone now, for that reason. The survivors are the two
 * `null`s: each of those pages still writes Enterprise's own value by hand,
 * because it formats as "Custom" or "Unlimited" and neither fits the sentence.
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
