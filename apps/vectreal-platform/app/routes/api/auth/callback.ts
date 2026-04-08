import { redirect } from 'react-router'

import { Route } from './+types/callback'
import { initializeUserDefaults } from '../../../lib/domain/user/user-repository.server'
import { createSupabaseClient } from '../../../lib/supabase.server'

import type { PostHogContext } from '../../../lib/posthog/posthog-middleware'

const SAFE_NEXT_PATH_PREFIXES = [
	'/dashboard',
	'/publisher',
	'/onboarding',
	'/home'
]

function getSafeNextPath(next: string | null): string {
	if (!next || !next.startsWith('/')) {
		return '/dashboard'
	}

	if (
		SAFE_NEXT_PATH_PREFIXES.some(
			(prefix) => next === prefix || next.startsWith(`${prefix}/`)
		)
	) {
		return next
	}

	return '/dashboard'
}

function buildSigninErrorRedirect(errorCode: string, next: string) {
	const params = new URLSearchParams({ error: errorCode, next })
	return `/sign-in?${params.toString()}`
}

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
			{
				headers
			}
		)
	}

	const { data: userData } = await client.auth.getUser()

	if (!userData.user) {
		console.warn('[auth/callback] missing user after successful code exchange')
		return redirect(buildSigninErrorRedirect('session_missing', next), {
			headers
		})
	}

	try {
		const userWithDefaults = await initializeUserDefaults(userData.user)
		const posthog = (context as PostHogContext).posthog
		posthog?.capture({
			distinctId: userData.user.id,
			event: 'user_signed_in',
			properties: {
				method: 'oauth',
				client_type: 'web'
			}
		})

		if (userWithDefaults.isNewUser && next === '/dashboard') {
			return redirect('/onboarding', {
				headers: new Headers(headers)
			})
		}
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

	return redirect(next, {
		headers: new Headers(headers)
	})
}
