/**
 * Stripe SDK configuration and singleton client factory.
 *
 * Design notes:
 *   - A single Stripe instance is cached per process to avoid re-initialisation
 *     overhead on every request.
 *   - Test-mode vs. live-mode is determined solely by the prefix of the secret
 *     key (`sk_test_` vs. `sk_live_`). No manual flag is needed.
 *   - Missing or malformed keys throw at startup so misconfiguration is
 *     discovered immediately rather than at the first billing API call.
 *   - The webhook secret is validated separately because it is only required
 *     at the webhook endpoint; a missing webhook secret only fails when that
 *     endpoint is actually invoked.
 */

import Stripe from 'stripe'

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

/**
 * Returns the validated Stripe secret key from environment variables.
 * Throws a descriptive error when the key is absent or has an unexpected prefix.
 */
function resolveStripeSecretKey(): string {
	const key = process.env.STRIPE_SECRET_KEY

	if (!key) {
		throw new Error(
			'Missing required environment variable: STRIPE_SECRET_KEY must be set'
		)
	}

	if (!key.startsWith('sk_test_') && !key.startsWith('sk_live_')) {
		throw new Error(
			'STRIPE_SECRET_KEY must begin with "sk_test_" (test mode) or "sk_live_" (live mode)'
		)
	}

	return key
}

/**
 * Returns the Stripe webhook signing secret from environment variables.
 * Throws when absent — call this only inside the webhook handler.
 */
export function resolveStripeWebhookSecret(): string {
	const secret = process.env.STRIPE_WEBHOOK_SECRET

	if (!secret) {
		throw new Error(
			'Missing required environment variable: STRIPE_WEBHOOK_SECRET must be set'
		)
	}

	return secret
}

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

let cachedStripe: Stripe | null = null

/**
 * Returns the singleton Stripe client.
 * Validates the secret key on first call.  Subsequent calls return the cached
 * instance.
 *
 * @throws {Error} When `STRIPE_SECRET_KEY` is missing or malformed.
 */
export function getStripeClient(): Stripe {
	if (cachedStripe) {
		return cachedStripe
	}

	const secretKey = resolveStripeSecretKey()

	cachedStripe = new Stripe(secretKey, {
		// Pin to the API version tested in CI to prevent unexpected surface changes.
		// Upgrade intentionally and update types when a new API version is adopted.
		apiVersion: '2026-02-25.clover',
		typescript: true
	})

	return cachedStripe
}

// ---------------------------------------------------------------------------
// Mode helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the Stripe client is operating in test mode
 * (i.e., the secret key starts with `sk_test_`).
 * Useful for conditional logging or test-only guardrails.
 */
export function isStripeTestMode(): boolean {
	const key = process.env.STRIPE_SECRET_KEY ?? ''
	return key.startsWith('sk_test_')
}
