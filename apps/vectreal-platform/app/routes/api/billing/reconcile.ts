/**
 * POST /api/billing/reconcile
 *
 * On-demand trigger for Stripe subscription drift reconciliation.
 *
 * This endpoint is intended for use by operators / scheduled jobs (e.g.,
 * a Cloud Scheduler cron) to detect and optionally repair divergences between
 * the local subscription state and Stripe.
 *
 * Request body (JSON, all optional):
 *   {
 *     repair: boolean  // default false — when true, repair detected drift
 *     limit: number    // default 500 — max subscriptions to examine
 *   }
 *
 * Access control:
 *   - Requires the `BILLING_RECONCILE_SECRET` environment variable to be set.
 *   - Callers must pass `Authorization: Bearer <BILLING_RECONCILE_SECRET>` in
 *     the request header.
 *   - This is a simple shared-secret guard appropriate for internal tooling.
 *     Do not expose this endpoint to end users.
 */

import { ApiResponse } from '@shared/utils'
import { timingSafeEqual } from 'node:crypto'

import { Route } from './+types/reconcile'
import { reconcileStripeSubscriptions } from '../../../lib/domain/billing/stripe-reconciliation.server'

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

function isAuthorized(request: Request): boolean {
	const secret = process.env.BILLING_RECONCILE_SECRET
	if (!secret) {
		// If the secret is not configured, deny all access
		return false
	}

	const authHeader = request.headers.get('authorization') ?? ''
	const [scheme, token] = authHeader.split(' ', 2)

	if (scheme !== 'Bearer' || !token) {
		return false
	}

	// Use timing-safe comparison to prevent timing attacks
	try {
		const secretBuf = Buffer.from(secret, 'utf8')
		const tokenBuf = Buffer.from(token, 'utf8')
		// Buffers must be the same length for timingSafeEqual; short-circuit
		// on length mismatch without revealing which is longer.
		return (
			secretBuf.length === tokenBuf.length &&
			timingSafeEqual(secretBuf, tokenBuf)
		)
	} catch {
		return false
	}
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }: Route.ActionArgs): Promise<Response> {
	if (request.method !== 'POST') {
		return ApiResponse.methodNotAllowed()
	}

	if (!isAuthorized(request)) {
		return ApiResponse.unauthorized(
			'Missing or invalid Authorization header'
		)
	}

	let body: { repair?: unknown; limit?: unknown } = {}

	try {
		const text = await request.text()
		if (text) {
			body = JSON.parse(text) as typeof body
		}
	} catch {
		return ApiResponse.badRequest('Invalid JSON body')
	}

	const repair = body.repair === true
	const limit =
		typeof body.limit === 'number' && body.limit > 0
			? Math.min(body.limit, 1000)
			: 500

	console.info('[billing/reconcile] starting reconciliation', {
		repair,
		limit
	})

	try {
		const report = await reconcileStripeSubscriptions({ repair, limit })

		console.info('[billing/reconcile] completed', {
			totalExamined: report.totalExamined,
			inSync: report.inSync,
			driftDetected: report.driftDetected,
			repaired: report.repaired,
			errors: report.errors.length
		})

		if (report.errors.length > 0) {
			console.warn(
				'[billing/reconcile] some rows encountered errors',
				report.errors
			)
		}

		return ApiResponse.success(report)
	} catch (err) {
		const message =
			err instanceof Error ? err.message : 'Reconciliation failed'
		console.error('[billing/reconcile] fatal error', { message })
		return ApiResponse.serverError(message)
	}
}
