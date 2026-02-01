import { ApiResponse } from '@shared/utils'

import { redirect } from 'react-router'

import { createSupabaseClient } from '../../../lib/supabase.server'

import { Route } from './+types/social-signin'

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData()
	const provider = formData.get('provider')
	const backURL = formData.get('backURL') || undefined

	const applicationUrl = backURL
		? new URL(backURL.toString(), request.url).toString()
		: process.env.APPLICATION_URL
	const redirectTo = `${applicationUrl}/auth/callback`

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
