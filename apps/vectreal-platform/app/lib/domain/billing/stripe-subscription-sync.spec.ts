/**
 * Which plan a Stripe subscription says an organization is on.
 *
 * This is the webhook's answer, and it is not checkout's: it records whatever
 * plan the subscription carries, `free` and `enterprise` included, where
 * checkout will only resolve one of the two it can sell. The search for the
 * value is shared with `stripe-price-plan`; only that acceptance rule differs,
 * and it is the reason this used to be a third copy of the search.
 */

import { describe, expect, it } from 'vitest'

import { resolvePlanFromSubscription } from './stripe-subscription-sync.server'

import type Stripe from 'stripe'

/** Only the fields the resolution reads. */
function subscription(price: unknown): Stripe.Subscription {
	return {
		items: { data: price === undefined ? [] : [{ price }] }
	} as unknown as Stripe.Subscription
}

describe('the plan a subscription is on', () => {
	it('reads it off the price', () => {
		expect(
			resolvePlanFromSubscription(
				subscription({ metadata: { vectreal_plan: 'business' } })
			)
		).toBe('business')
	})

	it('falls back to the product when the price says nothing', () => {
		expect(
			resolvePlanFromSubscription(
				subscription({
					metadata: {},
					product: { id: 'prod_1', metadata: { vectreal_plan: 'pro' } }
				})
			)
		).toBe('pro')
	})

	/*
	  The half checkout does not share. An enterprise subscription is a real
	  thing to be on, so it is recorded; `resolvePlanFromPrice` returns null for
	  the same value because it is asked a different question - what can be sold.
	*/
	it('records a plan checkout could not sell', () => {
		expect(
			resolvePlanFromSubscription(
				subscription({ metadata: { vectreal_plan: 'enterprise' } })
			)
		).toBe('enterprise')
	})

	/*
	  A deleted product is an object, so the old `typeof product !== 'string'`
	  test passed it and cast it to a live one. Only an optional chain on
	  `.metadata` kept that from throwing inside the webhook handler.
	*/
	it('survives a deleted or unexpanded product', () => {
		expect(
			resolvePlanFromSubscription(
				subscription({
					metadata: {},
					product: { id: 'prod_1', deleted: true }
				}),
				'business'
			)
		).toBe('business')

		expect(
			resolvePlanFromSubscription(
				subscription({ metadata: {}, product: 'prod_abc' }),
				'pro'
			)
		).toBe('pro')
	})

	it('falls back when there is nothing to read', () => {
		expect(resolvePlanFromSubscription(subscription(undefined))).toBe('free')
		expect(
			resolvePlanFromSubscription(
				subscription({ metadata: { vectreal_plan: 'toString' } }),
				'pro'
			)
		).toBe('pro')
	})
})
