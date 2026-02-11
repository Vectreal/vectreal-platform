import { ApiResponse } from '@shared/utils'

import type { ApiUserContext } from '../../types/api'
import { createSupabaseClient } from '../supabase.server'

export async function getAuthUser(
	request: Request
): Promise<ApiUserContext | Response> {
	const { client, headers } = await createSupabaseClient(request)
	const user = (await client.auth.getUser()).data.user

	if (!user) {
		return ApiResponse.unauthorized()
	}

	return { user, headers }
}
