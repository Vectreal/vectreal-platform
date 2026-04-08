import { type EmailOtpType } from '@supabase/supabase-js'
import { redirect } from 'react-router'

import { Route } from './+types/confirm'
import { createSupabaseClient } from '../../../lib/supabase.server'

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
	const searchParams = new URLSearchParams({ error: errorCode, next })
	return `/sign-in?${searchParams.toString()}`
}

export const loader = async ({ request }: Route.LoaderArgs) => {
	const { searchParams } = new URL(request.url)
	const token_hash = searchParams.get('token_hash')
	const type = searchParams.get('type') as EmailOtpType | null
	const next = getSafeNextPath(searchParams.get('next'))

	const { client, headers } = await createSupabaseClient(request)

	if (token_hash && type) {
		const { error } = await client.auth.verifyOtp({
			type,
			token_hash
		})
		if (!error) {
			// redirect user to specified redirect URL or root of app
			return redirect(next, { headers })
		}

		console.warn('[auth/confirm] OTP verification failed', {
			type,
			message: error.message
		})
	}

	return redirect(buildSigninErrorRedirect('verification_failed', next), {
		headers
	})
}
