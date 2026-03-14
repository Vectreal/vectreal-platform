/**
 * POST /api/billing/webhook
 *
 * Stripe webhook receiver.
 *
 * This endpoint is called by Stripe when billing events occur.  It does NOT
 * use Supabase session auth — instead it authenticates via Stripe's
 * HMAC-SHA256 webhook signature (`Stripe-Signature` header).
 *
 * Processing contract:
 *   1. Read the raw request body (signature verification requires the exact bytes).
 *   2. Verify the Stripe-Signature header.
 *   3. Delegate to `processStripeWebhookEvent` which handles idempotency and
 *      state synchronisation.
 *   4. Return 200 immediately to tell Stripe delivery succeeded.
 *      Any 4xx/5xx causes Stripe to retry for up to 3 days.
 *
 * Security:
 *   - Signature verification prevents forged events.
 *   - Only POST requests are accepted.
 *   - The endpoint must not be behind CSRF protection (Stripe cannot send tokens).
 *
 * Important:
 *   - The raw body must be read as text/buffer — do NOT call request.json()
 *     before passing to constructStripeEvent().
 */

import { ApiResponse } from '@shared/utils'

import { Route } from './+types/webhook'
import {
	constructStripeEvent,
	processStripeWebhookEvent
} from '../../../lib/domain/billing/stripe-webhook-processor.server'

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }: Route.ActionArgs): Promise<Response> {
	if (request.method !== 'POST') {
		return ApiResponse.methodNotAllowed()
	}

	const signatureHeader = request.headers.get('stripe-signature')

	if (!signatureHeader) {
		return ApiResponse.badRequest('Missing Stripe-Signature header')
	}

	// Read raw body — must be done before any other body-consuming call
	let rawBody: string
	try {
		rawBody = await request.text()
	} catch {
		return ApiResponse.badRequest('Failed to read request body')
	}

	// Verify signature and construct the typed event object
	let event
	try {
		event = constructStripeEvent(rawBody, signatureHeader)
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Signature verification failed'
		console.warn('[billing/webhook] signature verification failed', { message })
		return ApiResponse.error(message, 400)
	}

	// Process the event (idempotency guard + state sync)
	try {
		const result = await processStripeWebhookEvent(event)

		if (result.duplicate) {
			console.debug('[billing/webhook] duplicate event ignored', {
				eventId: event.id,
				eventType: event.type
			})
		} else {
			console.info('[billing/webhook] event processed', {
				eventId: event.id,
				eventType: event.type
			})
		}

		return ApiResponse.success({ received: true })
	} catch (err) {
		const message =
			err instanceof Error ? err.message : 'Internal processing error'
		console.error('[billing/webhook] processing failed', {
			eventId: event.id,
			eventType: event.type,
			message
		})
		// Return 500 so Stripe will retry the event
		return ApiResponse.serverError(message)
	}
}
