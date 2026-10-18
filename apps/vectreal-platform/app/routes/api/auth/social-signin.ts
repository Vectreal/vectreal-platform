import { ApiResponse } from '@shared/utils'
import { redirect } from 'react-router'

import { Route } from './+types/social-signin'
import { ensureValidCsrfFormData } from '../../../lib/http/csrf.server'
import { recordRateLimitAttempt } from '../../../lib/http/rate-limit.server'
import { verifyTurnstileToken } from '../../../lib/http/turnstile.server'
import { reportServerError } from '../../../lib/observability/report-server-error.server'
import { createSupabaseClient } from '../../../lib/supabase.server'

const OAUTH_PROVIDERS = new Set(['google', 'github'])

function getSafeNextPath(
	rawBackUrl: FormDataEntryValue | null,
	requestUrl: URL
) {
	const backUrlValue =
		typeof rawBackUrl === 'string' ? rawBackUrl : '/dashboard'
	const resolvedBackUrl = new URL(backUrlValue, requestUrl)
	return `${resolvedBackUrl.pathname}${resolvedBackUrl.search}${resolvedBackUrl.hash}`
}

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData()
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) {
		return csrfCheck
	}

	const provider = formData.get('provider')
	const backURL = formData.get('backURL')

	const requestUrl = new URL(request.url)
	const appOrigin =
		process.env.APPLICATION_URL || process.env.VECTREAL_URL || requestUrl.origin
	const applicationUrl = String(appOrigin)

	const knownProvider =
		typeof provider === 'string' && OAUTH_PROVIDERS.has(provider)
			? provider
			: null

	// Rate-limit before provider validation so invalid-provider probes are
	// throttled too. They share one key: keying on the raw value let a caller
	// rotate it for a fresh counter on every request.
	const rateLimitResult = recordRateLimitAttempt(request, {
		bucket: 'auth-social-signin',
		maxRequests: 30,
		windowMs: 60 * 1000,
		keyParts: [knownProvider ?? 'invalid']
	})

	if (rateLimitResult.limited) {
		return ApiResponse.error(
			'Too many authentication attempts. Try again soon.',
			429,
			{
				headers: {
					'Retry-After': String(rateLimitResult.retryAfterSeconds)
				}
			}
		)
	}

	if (!knownProvider) {
		return ApiResponse.badRequest('Invalid provider')
	}

	const turnstileToken = formData.get('cf-turnstile-response')
	const verification = await verifyTurnstileToken(
		typeof turnstileToken === 'string' ? turnstileToken : '',
		request
	)
	if (!verification.success) {
		return ApiResponse.error('Bot verification failed. Please try again.', 400)
	}

	const cleanAppUrl = applicationUrl.endsWith('/')
		? applicationUrl.slice(0, -1)
		: applicationUrl

	const next = getSafeNextPath(backURL, requestUrl)
	let redirectTo = `${cleanAppUrl}/auth/callback?next=${encodeURIComponent(next)}`

	const referrer = formData.get('referrer')
	const utm_source = formData.get('utm_source')
	if (typeof referrer === 'string' && referrer) {
		redirectTo += `&referrer=${encodeURIComponent(referrer)}`
	}
	if (typeof utm_source === 'string' && utm_source) {
		redirectTo += `&utm_source=${encodeURIComponent(utm_source)}`
	}

	const { client, headers } = await createSupabaseClient(request)

	// Standard OAuth signin
	const { data, error } = await client.auth.signInWithOAuth({
		provider: knownProvider as 'google' | 'github',
		options: { redirectTo }
	})

	if (error) {
		reportServerError(error, {
			request,
			properties: { provider: knownProvider }
		})
		return ApiResponse.serverError(
			'Authentication provider is temporarily unavailable'
		)
	}

	if (data.url) {
		return redirect(data.url, {
			headers
		})
	}

	reportServerError(
		new Error('OAuth initialization returned no redirect URL'),
		{ request, properties: { provider: knownProvider } }
	)

	return ApiResponse.serverError(
		'Authentication provider is temporarily unavailable'
	)
}
