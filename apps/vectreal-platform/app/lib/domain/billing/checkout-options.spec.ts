/**
 * A deployment without a Stripe key has no prices to sell, and says so rather
 * than failing: /pricing reported "Missing required environment variable:
 * STRIPE_SECRET_KEY" as a server error on every request wherever it was unset.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { getCheckoutOptions } from './billing-dashboard-loader.server'

// The loader module reaches the database client, which throws on import
// without DATABASE_URL. Nothing here queries it.
vi.mock('../../../db/client', () => ({ getDbClient: vi.fn() }))

beforeEach(() => vi.stubEnv('STRIPE_SECRET_KEY', ''))
afterEach(() => vi.unstubAllEnvs())

it('answers with no prices when Stripe is not configured', async () => {
	await expect(getCheckoutOptions()).resolves.toEqual({
		pro: { monthly: null, annual: null },
		business: { monthly: null, annual: null }
	})
})

it('still fails on a key that is set but malformed', async () => {
	vi.stubEnv('STRIPE_SECRET_KEY', 'not-a-key')
	await expect(getCheckoutOptions()).rejects.toThrow(/sk_test_/)
})
