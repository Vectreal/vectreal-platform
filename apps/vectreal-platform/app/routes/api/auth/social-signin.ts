import { ApiResponse } from '@shared/utils'
import { redirect } from 'react-router'

import { Route } from './+types/social-signin'
import { checkAuthRateLimit } from '../../../lib/domain/auth/auth-rate-limit.server'
import { ensureValidCsrfFormData } from '../../../lib/http/csrf.server'
import { verifyTurnstileToken } from '../../../lib/http/turnstile.server'
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

	// Rate-limit before provider validation so invalid-provider probes are throttled too.
	const rateLimitResult = checkAuthRateLimit(request, {
		bucket: 'auth-social-signin',
		maxRequests: 30,
		windowMs: 60 * 1000,
		keyParts: [typeof provider === 'string' ? provider : 'unknown']
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

	if (typeof provider !== 'string' || !OAUTH_PROVIDERS.has(provider)) {
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
		provider: provider as 'google' | 'github',
		options: { redirectTo }
	})

	if (error) {
		console.error('[auth/social-signin] OAuth initialization failed', {
			provider,
			message: error.message
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

	console.error(
		'[auth/social-signin] OAuth initialization returned no redirect URL',
		{
			provider
		}
	)

	return ApiResponse.serverError(
		'Authentication provider is temporarily unavailable'
	)
}
