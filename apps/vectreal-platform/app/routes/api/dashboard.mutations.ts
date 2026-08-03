/**
 * The single mutation endpoint for dashboard projects, folders and scenes.
 *
 * Replaces a route-local action for projects, a magic `bulk` sceneId on the
 * scene settings route for scenes and folders, and the two independently
 * hand-rolled response shapes they returned.
 *
 * Unlike the scene routes it replaces, this uses *token* CSRF rather than an
 * origin header check - the dashboard already has the token in context, and an
 * origin check passes when both Origin and Referer are absent.
 */

import { ApiResponse } from '@shared/utils'

import { QuotaExceededError } from '../../lib/domain/billing/quota-exceeded-error'
import { parseDashboardMutationRequest } from '../../lib/domain/dashboard/dashboard-mutations'
import {
	ConfirmationRequiredError,
	executeDashboardMutation
} from '../../lib/domain/dashboard/dashboard-mutations.server'
import { DashboardPermissionError } from '../../lib/domain/dashboard/dashboard-operations'
import { getAuthUser } from '../../lib/http/auth.server'
import { ensureValidCsrfFormData } from '../../lib/http/csrf.server'
import { ensurePost } from '../../lib/http/requests.server'

import type { ActionFunctionArgs } from 'react-router'

function withHeaders(response: Response, headers?: Headers): Response {
	if (!headers) {
		return response
	}

	const merged = new Headers(response.headers)
	headers.forEach((value, key) => {
		merged.append(key, value)
	})

	return new Response(response.body, {
		status: response.status,
		headers: merged
	})
}

export async function action({ request }: ActionFunctionArgs) {
	const methodCheck = ensurePost(request)
	if (methodCheck) {
		return methodCheck
	}

	const formData = await request.formData()

	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) {
		return csrfCheck
	}

	const authResult = await getAuthUser(request)
	if (authResult instanceof Response) {
		return authResult
	}
	const authHeaders = new Headers(authResult.headers)

	const fields: Record<string, unknown> = {}
	formData.forEach((value, key) => {
		if (typeof value === 'string') {
			fields[key] = value
		}
	})

	const parsed = parseDashboardMutationRequest(fields)
	if (!parsed.ok) {
		return withHeaders(ApiResponse.badRequest(parsed.error), authHeaders)
	}

	try {
		const result = await executeDashboardMutation(
			parsed.value,
			authResult.user.id
		)

		// A 200 here means the request was understood and every target was
		// attempted. Per-item outcomes live in `results` and `summary`.
		return withHeaders(ApiResponse.success(result), authHeaders)
	} catch (error) {
		if (error instanceof ConfirmationRequiredError) {
			return withHeaders(ApiResponse.forbidden(error.message), authHeaders)
		}

		if (error instanceof DashboardPermissionError) {
			return withHeaders(ApiResponse.forbidden(error.message), authHeaders)
		}

		if (error instanceof QuotaExceededError) {
			return withHeaders(
				ApiResponse.quotaExceeded(error.message, {
					limitKey: error.limitKey,
					currentValue: error.currentValue,
					limit: error.limit,
					plan: error.plan,
					upgradeTo: error.upgradeTo
				}),
				authHeaders
			)
		}

		return withHeaders(
			ApiResponse.badRequest(
				error instanceof Error ? error.message : 'Mutation failed'
			),
			authHeaders
		)
	}
}
