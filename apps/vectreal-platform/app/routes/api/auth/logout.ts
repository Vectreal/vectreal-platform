import { ApiResponse } from '@shared/utils'
import { redirect } from 'react-router'

import { createSupabaseClient } from '../../../lib/supabase.server'

import { Route } from './+types/logout'

export async function loader({ request }: Route.ActionArgs) {
	const { client, headers } = await createSupabaseClient(request)

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
