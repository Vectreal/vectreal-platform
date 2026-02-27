import { ApiResponse } from '@shared/utils'

import { createSupabaseClient } from '../supabase.server'

import type { ApiUserContext } from '../../types/api'

export async function getAuthUser(
	request: Request
): Promise<ApiUserContext | Response> {
	const { client, headers } = await createSupabaseClient(request)
	const {
		data: { user },
		error
	} = await client.auth.getUser()

	if (error?.code === 'refresh_token_not_found') {
		try {
			await client.auth.signOut({ scope: 'local' })
		} catch {
			// Ignore cleanup errors and continue as unauthenticated
		}
	}

	if (!user) {
		return ApiResponse.unauthorized('Unauthorized', { headers })
	}

	return { user, headers }
}
