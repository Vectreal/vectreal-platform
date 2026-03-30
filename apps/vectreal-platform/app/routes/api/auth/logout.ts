import { ApiResponse } from '@shared/utils'
import { redirect } from 'react-router'

import { Route } from './+types/logout'
import { ensureSameOriginMutation } from '../../../lib/http/csrf.server'
import { createSupabaseClient } from '../../../lib/supabase.server'

export async function loader() {
	return ApiResponse.methodNotAllowed()
}

export async function action({ request }: Route.ActionArgs) {
	if (request.method !== 'POST') {
		return ApiResponse.methodNotAllowed()
	}

	const csrfCheck = ensureSameOriginMutation(request)
	if (csrfCheck) {
		return csrfCheck
	}

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
