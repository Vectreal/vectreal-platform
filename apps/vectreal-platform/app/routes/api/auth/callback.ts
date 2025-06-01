import { ApiResponse } from '@vctrl-ui/utils'

import { redirect } from 'react-router'

import { createClient } from '../../../lib/supabase.server'

import { Route } from './+types/callback'

export async function loader({ request }: Route.ActionArgs) {
	const requestUrl = new URL(request.url)
	const code = requestUrl.searchParams.get('code')
	const next = requestUrl.searchParams.get('next') || '/dashboard'

	if (!code) return ApiResponse.badRequest('Missing code parameter')

	const { client, headers } = await createClient(request)
	const { error } = await client.auth.exchangeCodeForSession(code)

	if (error) {
		return ApiResponse.serverError(error.message)
	} else {
		return redirect(next, {
			headers
		})
	}
}
