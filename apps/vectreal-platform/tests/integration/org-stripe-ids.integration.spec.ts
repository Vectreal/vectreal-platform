/**
 * Reads the Stripe ids billing routes act on from a real `org_subscriptions`.
 *
 * Checkout picks in-place proration over a second subscription on these ids,
 * the portal refuses an organization without a customer, and a completed
 * checkout cancels the subscription it replaced. All three read through
 * `getOrgStripeIds`, so a query that returned another organization's row, or
 * dropped a column, would bill the wrong customer.
 *
 * Opt-in:
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { randomUUID } from 'node:crypto'

import { eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type Sync =
	typeof import('../../app/lib/domain/billing/stripe-subscription-sync.server')

describe('getOrgStripeIds', () => {
	let schema: Schema
	let db: Db
	let getOrgStripeIds: Sync['getOrgStripeIds']

	const ownerId = randomUUID()
	const subscribedOrgId = randomUUID()
	const otherOrgId = randomUUID()
	const freeOrgId = randomUUID()

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		;({ getOrgStripeIds } =
			await import('../../app/lib/domain/billing/stripe-subscription-sync.server'))

		await db.insert(schema.users).values({
			id: ownerId,
			email: `owner-${ownerId}@ids.test`,
			name: 'Owner'
		})
		await db.insert(schema.organizations).values(
			[subscribedOrgId, otherOrgId, freeOrgId].map((id) => ({
				id,
				name: `ids-${id}`,
				ownerId
			}))
		)
		await db.insert(schema.orgSubscriptions).values([
			{
				organizationId: subscribedOrgId,
				plan: 'pro',
				billingState: 'active',
				stripeCustomerId: `cus_${subscribedOrgId}`,
				stripeSubscriptionId: `sub_${subscribedOrgId}`
			},
			{
				organizationId: otherOrgId,
				plan: 'business',
				billingState: 'active',
				stripeCustomerId: `cus_${otherOrgId}`,
				stripeSubscriptionId: `sub_${otherOrgId}`
			}
		])
	})

	afterAll(async () => {
		if (!db) return
		const orgs = [subscribedOrgId, otherOrgId, freeOrgId]
		await db
			.delete(schema.orgSubscriptions)
			.where(inArray(schema.orgSubscriptions.organizationId, orgs))
		await db
			.delete(schema.organizations)
			.where(inArray(schema.organizations.id, orgs))
		await db.delete(schema.users).where(eq(schema.users.id, ownerId))
	})

	it("returns this organization's customer and subscription", async () => {
		expect(await getOrgStripeIds(subscribedOrgId)).toEqual({
			stripeCustomerId: `cus_${subscribedOrgId}`,
			stripeSubscriptionId: `sub_${subscribedOrgId}`
		})
	})

	it('returns nothing for an organization that never subscribed', async () => {
		expect(await getOrgStripeIds(freeOrgId)).toBeUndefined()
	})
})
