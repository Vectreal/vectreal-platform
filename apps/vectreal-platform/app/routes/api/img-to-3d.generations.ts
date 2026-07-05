import { ApiResponse } from '@shared/utils'
import { ActionFunctionArgs } from 'react-router'

import { submitImgTo3dGeneration } from '../../lib/domain/img-to-3d/img-to-3d-generation.server'
import { getAuthUser } from '../../lib/http/auth.server'
import { ensureSameOriginMutation } from '../../lib/http/csrf.server'
import { ensurePost } from '../../lib/http/requests.server'

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

	const formData = await request.formData()
	// Accept one or more images under the 'images' field. Per-file size validation
	// is handled inside submitImgTo3dGeneration so each file gets a useful error.
	const rawFiles = formData.getAll('images')
	const files = rawFiles.filter((f): f is File => f instanceof File)
	const targetProjectId = formData.get('targetProjectId')

	if (files.length === 0) {
		return ApiResponse.badRequest('At least one image file is required for generation.')
	}

	const response = await submitImgTo3dGeneration({
		request,
		userId: authResult.user.id,
		files,
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
