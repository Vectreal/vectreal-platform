import { ApiResponse } from '@shared/utils'

import {
	acquireHeavySceneActionToken,
	acquireSceneWriteLock,
	buildSceneRequestKey,
	completeIdempotentSceneRequest,
	failIdempotentSceneRequest,
	releaseHeavySceneActionToken,
	releaseSceneWriteLock,
	reserveIdempotentSceneRequest
} from './scene-action-guard.server'

/*
  The request-level guards the scene route wraps its actions in: coalescing a
  burst of identical reads, capping heavy work, holding the scene's write lock,
  and replaying an idempotent request. They lived in the route, which cannot be
  imported by a spec because it connects to the database on import; here the
  primitives can be mocked and each guard tested on its own.
*/

const MAX_IN_FLIGHT_HEAVY_SCENE_ACTIONS = 2
const inFlightGetSceneSettingsRequests = new Map<string, Promise<Response>>()

export function getSceneSettingsRequestKey(
	scope: string,
	sceneId: string
): string {
	return `${scope}:${sceneId}`
}

export async function runWithSceneSettingsCoalescing(
	key: string,
	operation: () => Promise<Response>
): Promise<Response> {
	const existingRequest = inFlightGetSceneSettingsRequests.get(key)
	if (existingRequest) {
		return existingRequest
	}

	const request = operation().finally(() => {
		inFlightGetSceneSettingsRequests.delete(key)
	})

	inFlightGetSceneSettingsRequests.set(key, request)

	return request
}

export async function runWithHeavySceneActionLimit(
	operation: () => Promise<Response>
): Promise<Response> {
	const acquiredToken = await acquireHeavySceneActionToken(
		MAX_IN_FLIGHT_HEAVY_SCENE_ACTIONS
	)

	if (!acquiredToken) {
		return ApiResponse.error('Server is busy, please retry in a moment', 503)
	}

	try {
		return await operation()
	} finally {
		await releaseHeavySceneActionToken()
	}
}

export async function runWithSceneWriteLock(
	sceneId: string,
	holderKey: string,
	operation: () => Promise<Response>
): Promise<Response> {
	const acquiredLock = await acquireSceneWriteLock({ sceneId, holderKey })
	if (!acquiredLock) {
		return ApiResponse.error(
			'Scene is currently being processed. Retry shortly.',
			409
		)
	}

	try {
		return await operation()
	} finally {
		await releaseSceneWriteLock({ sceneId, holderKey })
	}
}

export async function runWithIdempotentSceneRequest(params: {
	requestId?: string
	userId: string
	action: string
	sceneId?: string
	operation: () => Promise<Response>
}): Promise<Response> {
	if (!params.requestId) {
		return params.operation()
	}

	const requestKey = buildSceneRequestKey({
		requestId: params.requestId,
		userId: params.userId,
		action: params.action,
		sceneId: params.sceneId
	})

	const reservation = await reserveIdempotentSceneRequest({
		requestKey,
		requestId: params.requestId,
		userId: params.userId,
		action: params.action,
		sceneId: params.sceneId
	})

	if (!reservation) {
		return ApiResponse.serverError('Failed to reserve request state')
	}

	const existing = reservation.record

	if (existing.status === 'completed') {
		const body = existing.responseBody
		const status = existing.responseStatus ?? 200
		if (body && typeof body === 'object') {
			return new Response(JSON.stringify(body), {
				status,
				headers: { 'Content-Type': 'application/json' }
			})
		}
	}

	if (existing.status === 'pending' && reservation.created) {
		const response = await params.operation()

		try {
			const body = await response.clone().json()
			if (response.ok) {
				await completeIdempotentSceneRequest({
					requestKey,
					responseStatus: response.status,
					responseBody: body
				})
			} else {
				await failIdempotentSceneRequest({
					requestKey,
					errorMessage:
						typeof body?.error === 'string'
							? body.error
							: `Request failed with status ${response.status}`
				})
			}
		} catch {
			if (response.ok) {
				await completeIdempotentSceneRequest({
					requestKey,
					responseStatus: response.status,
					responseBody: {}
				})
			} else {
				await failIdempotentSceneRequest({
					requestKey,
					errorMessage: `Request failed with status ${response.status}`
				})
			}
		}

		return response
	}

	return ApiResponse.error(
		'A request with the same idempotency key is in progress',
		409
	)
}

/**
 * The chain every scene mutation runs through: replay a repeated request id,
 * refuse when the server is saturated, then hold the scene's write lock for
 * the length of the work. Save, publish and revoke each spelled it out.
 */
export function runGuardedSceneMutation(params: {
	requestId?: string
	userId: string
	action: string
	sceneId?: string
	operation: () => Promise<Response>
}): Promise<Response> {
	return runWithIdempotentSceneRequest({
		requestId: params.requestId,
		userId: params.userId,
		action: params.action,
		sceneId: params.sceneId,
		operation: () =>
			runWithHeavySceneActionLimit(() =>
				runWithSceneWriteLock(
					params.sceneId as string,
					`${params.userId}:${params.requestId ?? 'no-request-id'}`,
					params.operation
				)
			)
	})
}
