/**
 * POST /auth/send-email
 *
 * Supabase Auth `send_email` hook receiver.
 *
 * Supabase calls this endpoint whenever it needs to dispatch an auth email
 * (signup confirmation, magic link, password reset, email change, invite,
 * reauthentication OTP, and password-changed notification).
 *
 * The request is signed with HMAC-SHA256 using the StandardWebhooks spec
 * (headers: webhook-id, webhook-timestamp, webhook-signature).
 *
 * Environment variables required:
 *   SEND_EMAIL_HOOK_SECRET  - from Supabase dashboard / config.toml
 *   RESEND_API_KEY          - Resend API key
 *   FROM_EMAIL              - sender address, e.g. "Vectreal <auth@vectreal.com>"
 */

import { ApiResponse } from '@shared/utils'

import { sendAuthEmail } from '../../../lib/email/auth-email-sender.server'
import {
	buildHookErrorMessage,
	hookErrorResponse
} from '../../../lib/email/auth-hook-response'
import { verifyAuthHookRequest } from '../../../lib/email/auth-hook-verifier.server'
import { recordRateLimitAttempt } from '../../../lib/http/rate-limit.server'
import { reportServerError } from '../../../lib/observability/report-server-error.server'

import type { Route } from './+types/send-email'

export async function action({ request }: Route.ActionArgs): Promise<Response> {
	if (request.method !== 'POST') {
		return ApiResponse.methodNotAllowed()
	}

	let payloadText: string
	try {
		payloadText = await request.text()
	} catch {
		return ApiResponse.badRequest('Failed to read request body')
	}

	let payload
	try {
		payload = verifyAuthHookRequest({
			payload: payloadText,
			headers: {
				id: request.headers.get('webhook-id'),
				timestamp: request.headers.get('webhook-timestamp'),
				signature: request.headers.get('webhook-signature')
			}
		})
	} catch (err) {
		const message =
			err instanceof Error ? err.message : 'Invalid webhook signature'
		console.warn('[auth/send-email] signature verification failed', { message })

		/*
		  Reported, but bounded, and the bound is the point.

		  A rotated or mistyped `SEND_EMAIL_HOOK_SECRET` rejects every auth email,
		  and GoTrue turns the 401 into "Hook requires authorization token", which
		  the sign-up classifier reads as a delivery failure and answers with "try
		  signing up again in a moment". Retrying cannot help, so with only a
		  stdout line the outage is invisible where anyone would look for it.

		  But this route is public and unauthenticated by construction - the
		  signature *is* the authentication, so anything that runs before it
		  verifies runs for strangers too. Reporting every rejection would let a
		  stranger mint one billed exception per request, under a `distinct_id`
		  they choose via `X-POSTHOG-DISTINCT-ID`, and bury the real outage in the
		  noise. A handful per client per window is enough to raise a real outage -
		  Supabase calls from a stable set of addresses - and bounds what any one
		  caller can spend.
		*/
		const reportBudget = recordRateLimitAttempt(request, {
			bucket: 'auth-hook-signature-failure',
			maxRequests: 5
		})
		if (!reportBudget.limited) {
			reportServerError(err, {
				request,
				properties: { auth_hook_stage: 'signature_verification' }
			})
		}

		return ApiResponse.unauthorized('Unauthorized')
	}

	try {
		await sendAuthEmail(payload)
		return ApiResponse.success({ ok: true })
	} catch (err) {
		reportServerError(err, { request })
		/*
		  Not `ApiResponse.serverError`. GoTrue reads a hook's body only on 2xx,
		  and only when `error` is an object - so the envelope below is the one
		  shape that carries a reason back to the sign-up action. A plain 500 got
		  reported there as "Unexpected status code returned from hook: 500".
		*/
		return hookErrorResponse(buildHookErrorMessage(err))
	}
}
