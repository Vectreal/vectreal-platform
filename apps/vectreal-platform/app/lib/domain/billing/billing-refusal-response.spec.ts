import { describe, expect, it } from 'vitest'

import {
	billingRefusalResponse,
	quotaExceededResponse
} from './billing-refusal-response'
import { EntitlementRequiredError } from './entitlement-required-error'
import { QuotaExceededError } from './quota-exceeded-error'

const entitlementError = (billingState: 'active' | 'unpaid') =>
	new EntitlementRequiredError({
		entitlementKey: 'scene_publish',
		plan: 'pro',
		billingState,
		upgradeTo: null,
		message: 'Not on this plan'
	})

const quotaError = new QuotaExceededError({
	limitKey: 'scenes_total',
	currentValue: 3,
	limit: 3,
	plan: 'free',
	upgradeTo: 'pro',
	message: 'Scene limit reached'
})

describe('billingRefusalResponse', () => {
	it('asks a lapsed account to pay, not to upgrade', async () => {
		const response = billingRefusalResponse(entitlementError('unpaid'))

		expect(response?.status).toBe(402)
		expect((await response?.json()).error).toBe('Not on this plan')
	})

	it('refuses a feature the plan lacks with 403', async () => {
		const response = billingRefusalResponse(entitlementError('active'))

		expect(response?.status).toBe(403)
		expect((await response?.json()).error).toBe('Not on this plan')
	})

	it('maps a quota refusal through quotaExceededResponse', async () => {
		const response = billingRefusalResponse(quotaError)

		expect(response?.status).toBe(quotaExceededResponse(quotaError).status)
		expect(await response?.json()).toEqual(
			await quotaExceededResponse(quotaError).json()
		)
	})

	it('leaves any other error to the caller', () => {
		expect(billingRefusalResponse(new Error('db down'))).toBeNull()
	})
})

describe('quotaExceededResponse', () => {
	it('carries every field the upgrade prompt reads', async () => {
		const body = await quotaExceededResponse(quotaError).json()

		expect(body).toMatchObject({
			success: false,
			error: 'Scene limit reached',
			quota: {
				limitKey: 'scenes_total',
				currentValue: 3,
				limit: 3,
				plan: 'free',
				upgradeTo: 'pro'
			}
		})
	})
})
