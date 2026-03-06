import { ApiResponse } from '@shared/utils'
import { redirect } from 'react-router'

import { Route } from './+types/social-signin'
import { createSupabaseClient } from '../../../lib/supabase.server'


export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData()
	const provider = formData.get('provider')
	const backURL = formData.get('backURL')
	const requestUrl = new URL(request.url)
	const applicationUrl = String(process.env.APPLICATION_URL || requestUrl.origin)

	const cleanAppUrl = applicationUrl.endsWith('/')
		? applicationUrl.slice(0, -1)
		: applicationUrl

	const backUrlValue = typeof backURL === 'string' ? backURL : '/dashboard'
	const resolvedBackUrl = new URL(backUrlValue, requestUrl)
	const next = `${resolvedBackUrl.pathname}${resolvedBackUrl.search}${resolvedBackUrl.hash}`
	const redirectTo = `${cleanAppUrl}/auth/callback?next=${encodeURIComponent(next)}`

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
