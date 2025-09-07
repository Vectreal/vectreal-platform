import { data } from 'react-router'

import { createClient } from '../../lib/supabase.server'

import { Route } from './+types/convert-anonymous-user'

export async function action({ request }: Route.ActionArgs) {
	if (request.method !== 'POST') {
		return data({ error: 'Method not allowed' }, { status: 405 })
	}

	try {
		const { provider } = (await request.json()) as {
			provider: 'google' | 'github'
		}

		const { client, headers } = await createClient(request)

		// First, get the current user (should be anonymous)
		const { data: currentUser, error: getCurrentUserError } =
			await client.auth.getUser()

		if (getCurrentUserError || !currentUser.user) {
			return data({ error: 'No current user found' }, { status: 401 })
		}

		// Check if the user is anonymous and has temp scene data
		if (!currentUser.user.is_anonymous) {
			return data({ error: 'User is not anonymous' }, { status: 400 })
		}

		const tempSceneData = currentUser.user.user_metadata?.tempScene

		// Initiate OAuth linking
		const { data: authData, error: authError } = await client.auth.linkIdentity(
			{
				provider,
				options: {
					redirectTo: `${new URL(request.url).origin}/auth/callback?convert=true`
				}
			}
		)

		if (authError) {
			console.error('Error linking identity:', authError)
			return data({ error: 'Failed to link identity' }, { status: 500 })
		}

		return data(
			{
				success: true,
				authUrl: authData.url,
				tempSceneData,
				message: 'Redirecting to authentication provider...'
			},
			{ headers }
		)
	} catch (error) {
		console.error('Error converting anonymous user:', error)
		return data({ error: 'Failed to convert user' }, { status: 500 })
	}
}
