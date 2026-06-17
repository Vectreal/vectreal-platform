import { ApiResponse } from '@shared/utils'
import { LoaderFunctionArgs } from 'react-router'

import { getImgTo3dGenerationStatus } from '../../lib/domain/img-to-3d/img-to-3d-generation.server'
import { getAuthUser } from '../../lib/http/auth.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
	const authResult = await getAuthUser(request)
	if (authResult instanceof Response) {
		return authResult
	}

	const jobId = params.jobId?.trim()
	if (!jobId) {
		return ApiResponse.badRequest('Generation job ID is required.')
	}

	const jobToken = new URL(request.url).searchParams.get('token')?.trim()
	if (!jobToken) {
		return ApiResponse.badRequest('Generation token is required.')
	}

	const response = await getImgTo3dGenerationStatus({
		jobId,
		jobToken,
		userId: authResult.user.id
	})

	const headers = new Headers(response.headers)
	new Headers(authResult.headers).forEach((value, key) => {
		headers.set(key, value)
	})

	return new Response(response.body, {
		status: response.status,
		headers
	})
}
