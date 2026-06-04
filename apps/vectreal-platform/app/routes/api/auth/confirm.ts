import { type EmailOtpType } from '@supabase/supabase-js'
import { redirect } from 'react-router'

import { Route } from './+types/confirm'
import { captureServerEvent } from '../../../lib/domain/analytics/server-events.server'
import {
	buildSigninErrorRedirect,
	getSafeNextPath
} from '../../../lib/domain/auth/auth-redirect.server'
import { createSupabaseClient } from '../../../lib/supabase.server'

import type { PostHogContext } from '../../../lib/posthog/posthog-middleware'

export const loader = async ({ request, context }: Route.LoaderArgs) => {
	const { searchParams } = new URL(request.url)
	const token_hash = searchParams.get('token_hash')
	const type = searchParams.get('type') as EmailOtpType | null
	const next = getSafeNextPath(searchParams.get('next'))

	const { client, headers } = await createSupabaseClient(request)

	if (token_hash && type) {
		const { error, data } = await client.auth.verifyOtp({ type, token_hash })
		if (!error) {
			if (type === 'signup' && !data.user) {
				console.warn('[auth/confirm] signup OTP verified but no user returned', {
					token_hash_prefix: token_hash.slice(0, 8)
				})
			}
			if (type === 'signup' && data.user) {
				const referrer = searchParams.get('referrer') || undefined
				const utm_source = searchParams.get('utm_source') || undefined
				const posthog = (context as PostHogContext).posthog
				captureServerEvent(posthog, data.user.id, {
					name: 'user_signed_up',
					props: { method: 'email', referrer, utm_source }
				})
			}

			const destination = type === 'signup' ? '/onboarding' : next
			return redirect(destination, { headers })
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
