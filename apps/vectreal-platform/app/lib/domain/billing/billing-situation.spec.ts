/**
 * What the billing page says is happening, for every state it can be in.
 *
 * The page's whole content is this sentence plus the plan name, so a state that
 * produces the wrong one is the page being wrong. `BillingState` is a closed
 * union and the function returns for every member, so a missing case is a
 * compile error rather than a test - which is why nothing here counts branches.
 *
 * Expectations are literals on both sides. Deriving one from the input, or from
 * the same constant the production line reads, passes for any contents of it:
 * that is how #846's cap test came to hold for an empty list.
 */

import { describe, expect, it, vi } from 'vitest'

import { describeBillingSituation } from './billing-situation'

import type { BillingSituationInput } from './billing-situation'

const FREE: BillingSituationInput = {
	plan: 'free',
	billingState: 'none',
	currentPeriodEnd: null,
	trialEnd: null
}

const ACTIVE: BillingSituationInput = {
	plan: 'pro',
	billingState: 'active',
	currentPeriodEnd: '2026-10-12T00:00:00.000Z',
	trialEnd: null
}

describe('an account with no subscription', () => {
	it('says nothing is being charged, and offers nothing to fix', () => {
		const situation = describeBillingSituation(FREE)

		expect(situation.headline).toBe('Nothing is being charged.')
		expect(situation.remedy).toBeNull()
		expect(situation.isProblem).toBe(false)
	})

	it('does not tell a paid plan it is being charged nothing', () => {
		/*
		  `plan: 'pro'` with no billing state is a self-granted account, and both
		  that exist in production are the owner's own. "Nothing is being charged"
		  is true of it and still wrong, because it reads as a Free account.
		*/
		expect(describeBillingSituation({ ...FREE, plan: 'pro' }).headline).toBe(
			'No subscription is attached to this plan.'
		)
	})
})

describe('an active subscription', () => {
	it('leads with the date it next charges', () => {
		expect(describeBillingSituation(ACTIVE).headline).toBe(
			'Renews Oct 12, 2026.'
		)
	})

	it('says it is active when there is no date to give', () => {
		/*
		  `current_period_end` is nullable, and the two production rows carrying a
		  paid plan have held a stale one for months. A missing date has to read as
		  a missing date rather than as `Renews Invalid Date`.
		*/
		expect(
			describeBillingSituation({ ...ACTIVE, currentPeriodEnd: null }).headline
		).toBe('Your subscription is active.')
	})

	it('does not announce a renewal that has already gone by', () => {
		/*
		  Nothing advances `current_period_end` across a renewal on its own -
		  `syncSubscriptionFromStripe` is reached from the webhook and the
		  checkout success page, and both production rows on a paid plan have
		  held a stale date for months. As the page's headline that would state a
		  future already in the past.
		*/
		expect(
			describeBillingSituation({
				...ACTIVE,
				currentPeriodEnd: '2026-03-03T00:00:00.000Z'
			}).headline
		).toBe('Your subscription is active.')
	})

	it('formats the date as en-US, so the server and the browser agree', () => {
		/*
		  The assertion above cannot catch this. It passes on an en-US machine
		  whether or not the locale is pinned, and CI is such a machine, so the
		  pin is asserted directly: drop the argument and this goes red anywhere.

		  Every dashboard page is server-rendered. An unpinned locale is formatted
		  once by the container and again by the browser, and for a reader outside
		  the US the two disagree.
		*/
		const spy = vi.spyOn(Date.prototype, 'toLocaleDateString')

		describeBillingSituation(ACTIVE)

		expect(spy).toHaveBeenCalledWith('en-US', expect.anything())
		spy.mockRestore()
	})
})

describe('a trial', () => {
	it('leads with the date it ends', () => {
		expect(
			describeBillingSituation({
				...ACTIVE,
				billingState: 'trialing',
				trialEnd: '2026-09-20T00:00:00.000Z'
			}).headline
		).toBe('Your trial ends Sep 20, 2026.')
	})

	it('says a trial is running when there is no date to give', () => {
		expect(
			describeBillingSituation({
				...ACTIVE,
				billingState: 'trialing',
				trialEnd: null
			}).headline
		).toBe('Your trial is running.')
	})
})

describe('a state the reader has to fix', () => {
	/*
	  Both halves as literals. `expect(remedy).not.toBeNull()` was the whole
	  assertion here, and it passes for any words at all - which is how the one
	  remedy carrying a promise the product does not keep ("update your payment
	  method within 7 days, after that the account becomes read-only") was the
	  only one no test could see.
	*/
	it.each([
		[
			'past_due',
			'A payment failed.',
			'Update your payment method to settle the invoice.'
		],
		[
			'unpaid',
			'Uploads and publishing are blocked.',
			'Settle the outstanding invoice to start publishing again.'
		],
		[
			'paused',
			'The subscription is paused.',
			'Uploads and publishing stay blocked until it resumes.'
		]
	] as const)(
		'%s names the problem and the way out',
		(state, headline, remedy) => {
			const situation = describeBillingSituation({
				...ACTIVE,
				billingState: state
			})

			expect(situation.headline).toBe(headline)
			expect(situation.remedy).toBe(remedy)
			expect(situation.isProblem).toBe(true)
		}
	)

	it('promises no deadline the product does not keep', () => {
		/*
		  `past_due` is in neither `READ_ONLY_BILLING_STATES` nor
		  `BLOCKING_BILLING_STATES`, nothing moves a row off it on a timer, and
		  there is no scheduler in the product that could. Whatever happens next
		  is Stripe's retry policy, configured outside this repo.
		*/
		const situation = describeBillingSituation({
			...ACTIVE,
			billingState: 'past_due'
		})

		expect(`${situation.headline} ${situation.remedy}`).not.toMatch(
			/7 days|read-only|within \d/i
		)
	})

	it('does not call the blocked states read-only', () => {
		/*
		  `READ_ONLY_BLOCKED_ENTITLEMENTS` is `scene_upload` and `scene_publish`
		  alone, and `dashboard-mutations.server.ts` reads the billing state
		  nowhere - so creating, renaming and deleting all still work. The
		  internal name for these states is not what they do to a reader.
		*/
		for (const billingState of ['unpaid', 'paused'] as const) {
			const situation = describeBillingSituation({ ...ACTIVE, billingState })
			expect(`${situation.headline} ${situation.remedy}`).not.toMatch(
				/read-only/i
			)
		}
	})

	it('separates access being intact from access being gone', () => {
		/*
		  `past_due` is the only state that needs fixing while the account still
		  works, which is why this cannot read `BLOCKING_BILLING_STATES` and why
		  the page's own hand-written six-state list existed. Both directions are
		  asserted: a rule that flagged everything would pass the line above.
		*/
		expect(
			describeBillingSituation({ ...ACTIVE, billingState: 'past_due' })
				.isProblem
		).toBe(true)
		expect(describeBillingSituation(ACTIVE).isProblem).toBe(false)
		expect(describeBillingSituation(FREE).isProblem).toBe(false)
	})
})

describe('a checkout that did not finish', () => {
	it.each([
		['incomplete', 'Checkout was not completed.'],
		['incomplete_expired', 'Checkout expired.']
	] as const)('%s says nothing was charged', (state, headline) => {
		/*
		  Not a problem to fix. The reader closed a payment form; the account is
		  exactly as it was, and telling them so in red invents a failure.
		*/
		const situation = describeBillingSituation({
			...ACTIVE,
			billingState: state
		})

		expect(situation.headline).toBe(headline)
		expect(situation.remedy).toBe(
			'Nothing was charged. Start again whenever you are ready.'
		)
		expect(situation.isProblem).toBe(false)
	})
})

describe('a canceled subscription', () => {
	it('is reported rather than alarmed', () => {
		/*
		  The reader canceled on purpose. Access is back at Free, so it is stated
		  plainly - but a red notice telling someone what they just chose is a
		  scolding, and the notice it used to raise carried a promise instead of a
		  remedy.
		*/
		const situation = describeBillingSituation({
			...ACTIVE,
			billingState: 'canceled'
		})

		expect(situation.headline).toBe('Your Pro subscription was canceled.')
		expect(situation.isProblem).toBe(false)
	})

	it('names the plan that ended, not the one now in force', () => {
		/*
		  The panel beside this states the effective plan, so the two would
		  otherwise say "Free" twice and never mention what was lost.
		*/
		expect(
			describeBillingSituation({
				...ACTIVE,
				plan: 'business',
				billingState: 'canceled'
			}).headline
		).toBe('Your Business subscription was canceled.')
	})

	it('makes no retention promise', () => {
		/*
		  This sentence used to end "Scenes and assets exceeding Free limits will
		  be retained for 90 days before deletion". No constant carries 90 days,
		  nothing deletes over-limit content, and there is no scheduler in the
		  product that could - the limits are enforced where content is created.
		  It was a commitment made at the one moment a reader is most likely to
		  rely on it.
		*/
		const situation = describeBillingSituation({
			...ACTIVE,
			billingState: 'canceled'
		})

		const said = `${situation.headline} ${situation.remedy ?? ''}`
		expect(said).not.toMatch(/90 days|retained|before deletion/i)
		expect(said).toContain('Nothing was deleted')
	})
})

describe('the plan actually in force', () => {
	/*
	  The row keeps the paid plan after a subscription ends, so the stored value
	  and the held value disagree for exactly the states below. The page printed
	  the stored one, which is how a canceled organization came to read `Pro`
	  above a sentence saying its Pro subscription had ended - and, before the
	  header said anything, to be offered a paying customer's plan comparison.

	  `resolveEffectivePlan` already encodes this and is private to a `.server`
	  module no component can import.
	*/
	it.each(['canceled', 'incomplete', 'incomplete_expired'] as const)(
		'%s holds Free however the row is labelled',
		(state) => {
			expect(
				describeBillingSituation({ ...ACTIVE, billingState: state })
					.effectivePlan
			).toBe('free')
		}
	)

	it.each(['active', 'trialing', 'past_due', 'unpaid', 'paused'] as const)(
		'%s still holds the plan it pays for',
		(state) => {
			/*
			  `past_due`, `unpaid` and `paused` restrict what can be done, and
			  none of them takes the plan away. Reading them as Free would drop a
			  paying customer's limits to the free ones while their card is being
			  fixed.
			*/
			expect(
				describeBillingSituation({ ...ACTIVE, billingState: state })
					.effectivePlan
			).toBe('pro')
		}
	)
})
