import { ApiResponse } from '@vctrl-ui/utils'

import { redirect } from 'react-router'

import { createClient } from '../../../lib/supabase.server'

import { Route } from './+types/logout'

export async function loader({ request }: Route.ActionArgs) {
	const { client, headers } = await createClient(request)

	console.log('Logging out user...')

	// Sign out the user
	const { error } = await client.auth.signOut()

	if (error) {
		return ApiResponse.serverError(error.message)
	}

	// Return a success response with headers
	return redirect('/', {
		headers
	})
}
