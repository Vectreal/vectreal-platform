import { ApiResponse } from '@vctrl-ui/utils'

import { redirect } from 'react-router'

import { createSupabaseClient } from '../../../lib/supabase.server'

import { Route } from './+types/social-signin'

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData()
	const provider = formData.get('provider')

	const { client, headers } = await createSupabaseClient(request)

	// Standard OAuth signin
	const { data, error } = await client.auth.signInWithOAuth({
		provider: provider as 'google' | 'github',
		options: { redirectTo: `${process.env.VECTREAL_URL}/auth/callback` }
	})

	if (error) {
		return ApiResponse.serverError(error.message)
	}

	if (data.url) {
		return redirect(data.url, {
			headers
		})
	}
}
