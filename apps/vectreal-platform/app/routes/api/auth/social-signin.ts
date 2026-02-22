import { ApiResponse } from '@shared/utils'
import { redirect } from 'react-router'

import { Route } from './+types/social-signin'
import { createSupabaseClient } from '../../../lib/supabase.server'


export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData()
	const provider = formData.get('provider')
	const backURL = formData.get('backURL') || undefined

	const applicationUrl = String(
		backURL
			? new URL(backURL.toString(), request.url).toString()
			: process.env.APPLICATION_URL
	)

	const cleanAppUrl = applicationUrl.endsWith('/')
		? applicationUrl.slice(0, -1)
		: applicationUrl

	const redirectTo = `${cleanAppUrl}/auth/callback`

	if (typeof provider !== 'string') {
		return ApiResponse.badRequest('Invalid provider')
	}

	const { client, headers } = await createSupabaseClient(request)

	// Standard OAuth signin
	const { data, error } = await client.auth.signInWithOAuth({
		provider: provider as 'google' | 'github',
		options: { redirectTo }
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
