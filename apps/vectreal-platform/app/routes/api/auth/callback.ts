import { redirect } from 'react-router'

import { Route } from './+types/callback'
import { captureServerEvent } from '../../../lib/domain/analytics/server-events.server'
import {
	buildSigninErrorRedirect,
	getSafeNextPath
} from '../../../lib/domain/auth/auth-redirect.server'
import { initializeUserDefaults } from '../../../lib/domain/user/user-repository.server'
import { createSupabaseClient } from '../../../lib/supabase.server'

import type { PostHogContext } from '../../../lib/posthog/posthog-middleware'

export async function loader({ request, context }: Route.LoaderArgs) {
	const requestUrl = new URL(request.url)
	const code = requestUrl.searchParams.get('code')
	const next = getSafeNextPath(requestUrl.searchParams.get('next'))

	if (!code) {
		return redirect(buildSigninErrorRedirect('missing_code', next))
	}

	const { client, headers } = await createSupabaseClient(request)
	const { error } = await client.auth.exchangeCodeForSession(code)

	if (error) {
		console.error('[auth/callback] code exchange failed', {
			message: error.message
		})
		return redirect(
			buildSigninErrorRedirect('provider_exchange_failed', next),
			{ headers }
		)
	}

	const { data: userData } = await client.auth.getUser()

	if (!userData.user) {
		console.warn('[auth/callback] missing user after successful code exchange')
		return redirect(buildSigninErrorRedirect('session_missing', next), {
			headers
		})
	}

	let userWithDefaults: Awaited<ReturnType<typeof initializeUserDefaults>>

	try {
		userWithDefaults = await initializeUserDefaults(userData.user)
	} catch (dbError) {
		console.error('[auth/callback] user initialization failed', {
			error: dbError,
			userId: userData.user.id,
			userEmail: userData.user.email
		})

		try {
			await client.auth.signOut({ scope: 'local' })
		} catch (signOutError) {
			console.warn('[auth/callback] local signout after init failure failed', {
				error: signOutError
			})
		}

		return redirect(buildSigninErrorRedirect('user_init_failed', next), {
			headers: new Headers(headers)
		})
	}

	const posthog = (context as PostHogContext).posthog
	captureServerEvent(posthog, userData.user.id, {
		name: 'user_signed_in',
		props: { method: 'oauth' }
	})

	if (userWithDefaults.isNewUser) {
		const referrer = requestUrl.searchParams.get('referrer')
		const utm_source = requestUrl.searchParams.get('utm_source')
		captureServerEvent(posthog, userData.user.id, {
			name: 'user_signed_up',
			props: {
				method: 'oauth',
				referrer: referrer || undefined,
				utm_source: utm_source || undefined
			}
		})
	}

	// Send ALL new users through onboarding, not just those arriving at /dashboard.
	// Preserve next so onboarding can redirect to the original deep-link destination after completion.
	if (userWithDefaults.isNewUser && next !== '/onboarding') {
		const onboardingUrl =
			next === '/dashboard'
				? '/onboarding'
				: `/onboarding?next=${encodeURIComponent(next)}`
		return redirect(onboardingUrl, { headers: new Headers(headers) })
	}

	return redirect(next, { headers: new Headers(headers) })
}
