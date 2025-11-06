import { type EmailOtpType } from '@supabase/supabase-js'
import { redirect } from 'react-router'

import { createSupabaseClient } from '../../../lib/supabase.server'

import { Route } from './+types/confirm'

export const loader = async ({ request }: Route.LoaderArgs) => {
	const { searchParams } = new URL(request.url)
	const token_hash = searchParams.get('token_hash')
	const type = searchParams.get('type') as EmailOtpType | null
	const next = searchParams.get('next') ?? '/dashboard'

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
	}

	// redirect the user to an error page with some instructions
	return redirect('/error', {
		headers
	})
}
