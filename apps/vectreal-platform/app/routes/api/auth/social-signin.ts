import { ApiResponse } from '@vctrl-ui/utils'

import { redirect } from 'react-router'

import { createClient } from '../../../lib/supabase.server'

import { Route } from './+types/social-signin'

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData()
	const provider = formData.get('provider')

	const { client, headers } = await createClient(request)

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
