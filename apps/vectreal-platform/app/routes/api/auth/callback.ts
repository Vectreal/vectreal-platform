import { ApiResponse } from '@vctrl-ui/utils'

import { redirect } from 'react-router'

import { userService } from '../../../lib/services/user.service'
import { createClient } from '../../../lib/supabase.server'

import { Route } from './+types/callback'

export async function loader({ request }: Route.ActionArgs) {
	const requestUrl = new URL(request.url)
	const code = requestUrl.searchParams.get('code')
	const next = requestUrl.searchParams.get('next') || '/dashboard'
	const convert = requestUrl.searchParams.get('convert') === 'true'

	if (!code) return ApiResponse.badRequest('Missing code parameter')

	const { client, headers } = await createClient(request)
	const { error } = await client.auth.exchangeCodeForSession(code)

	if (error) {
		return ApiResponse.serverError(error.message)
	} else {
		// Get the authenticated user
		const { data: userData } = await client.auth.getUser()

		if (userData.user) {
			// Initialize user with defaults (user, organization, project) in local database
			await userService.initializeUserDefaults(userData.user)
		}

		// Check if this was an anonymous user conversion
		if (convert) {
			if (userData.user) {
				// Get the temp scene data from user metadata
				const tempSceneData = userData.user.user_metadata?.tempScene

				if (tempSceneData) {
					// Clear the temp scene data from metadata
					await client.auth.updateUser({
						data: {
							tempScene: null
						}
					})

					// TODO: Create permanent scene record in database
					// For now, redirect to publisher with scene config
					return redirect('/publisher?scene_converted=true', {
						headers
					})
				}
			}
		}

		// Use the next parameter or default to dashboard
		return redirect(next, {
			headers: new Headers(headers)
		})
	}
}
