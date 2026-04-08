import { ApiResponse } from '@shared/utils'
import { redirect } from 'react-router'

import { Route } from './+types/social-signin'
import { checkAuthRateLimit } from '../../../lib/domain/auth/auth-rate-limit.server'
import { ensureValidCsrfFormData } from '../../../lib/http/csrf.server'
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

	const providerValue = typeof provider === 'string' ? provider : ''
	const rateLimitResult = checkAuthRateLimit(request, {
		bucket: 'auth-social-signin',
		maxRequests: 30,
		windowMs: 60 * 1000,
		keyParts: [providerValue || 'unknown']
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

	const cleanAppUrl = applicationUrl.endsWith('/')
		? applicationUrl.slice(0, -1)
		: applicationUrl

	const next = getSafeNextPath(backURL, requestUrl)
	const redirectTo = `${cleanAppUrl}/auth/callback?next=${encodeURIComponent(next)}`

	if (typeof provider !== 'string' || !OAUTH_PROVIDERS.has(provider)) {
		console.warn('[auth/social-signin] rejected invalid provider', {
			provider: providerValue || 'missing'
		})
		return ApiResponse.badRequest('Invalid provider')
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
