import { ActionFunctionArgs } from 'react-router'

import { submitTrellisGeneration } from '../../lib/domain/trellis/trellis-generation.server'
import { getAuthUser } from '../../lib/http/auth.server'
import { ensureSameOriginMutation } from '../../lib/http/csrf.server'
import { ensurePost } from '../../lib/http/requests.server'
import { ApiResponse } from '@shared/utils'

export async function action({ request }: ActionFunctionArgs) {
	const methodCheck = ensurePost(request)
	if (methodCheck) {
		return methodCheck
	}

	const csrfCheck = ensureSameOriginMutation(request)
	if (csrfCheck) {
		return csrfCheck
	}

	const authResult = await getAuthUser(request)
	if (authResult instanceof Response) {
		return authResult
	}

	const contentLength = Number(request.headers.get('content-length') || '0')
	const maxImageBytes = Number(process.env.TRELLIS_MAX_IMAGE_BYTES || 10 * 1024 * 1024)
	if (contentLength > maxImageBytes) {
		return ApiResponse.error(
			`Uploaded image exceeds the ${Math.round(maxImageBytes / (1024 * 1024))} MB limit.`,
			413,
			{ headers: new Headers(authResult.headers) }
		)
	}

	const formData = await request.formData()
	const file = formData.get('image')
	const targetProjectId = formData.get('targetProjectId')

	if (!(file instanceof File)) {
		return ApiResponse.badRequest('Image file is required for generation.')
	}

	const response = await submitTrellisGeneration({
		request,
		userId: authResult.user.id,
		file,
		targetProjectId:
			typeof targetProjectId === 'string' && targetProjectId.trim()
				? targetProjectId.trim()
				: undefined
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

