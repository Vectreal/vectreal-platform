import { ApiResponse } from '@vctrl-ui/utils'

import { redirect } from 'react-router'

import { userService } from '../../../lib/services/user-service.server'
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
		// Get the authenticated user
		const { data: userData } = await client.auth.getUser()

		if (userData.user) {
			try {
				// Initialize user with defaults (user, organization, project) in local database
				await userService.initializeUserDefaults(userData.user)
			} catch (dbError) {
				console.error('Database error during user initialization:', {
					error: dbError,
					userId: userData.user.id,
					userEmail: userData.user.email
				})
				// Don't fail the auth flow, but log the error
				// User will still be authenticated via Supabase
			}
		}

		// Use the next parameter or default to dashboard
		return redirect(next, {
			headers: new Headers(headers)
		})
	}
}
