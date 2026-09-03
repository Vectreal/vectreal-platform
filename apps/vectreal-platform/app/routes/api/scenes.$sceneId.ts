import { ApiResponse } from '@shared/utils'
import { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'

import { isBillingStateReadOnly } from '../../constants/plan-config'
import { validatePreviewApiKeyForProject } from '../../lib/domain/auth/preview-api-key-auth.server'
import { EntitlementRequiredError } from '../../lib/domain/billing/entitlement-required-error'
import { QuotaExceededError } from '../../lib/domain/billing/quota-exceeded-error'
import { getProject } from '../../lib/domain/project/project-repository.server'
import { parseSceneBytes } from '../../lib/domain/scene/scene-size-limit'
import {
	acquireHeavySceneActionToken,
	acquireSceneWriteLock,
	buildSceneRequestKey,
	completeIdempotentSceneRequest,
	failIdempotentSceneRequest,
	releaseHeavySceneActionToken,
	releaseSceneWriteLock,
	reserveIdempotentSceneRequest
} from '../../lib/domain/scene/server/scene-action-guard.server'
import {
	getScene,
	updateSceneMetadata
} from '../../lib/domain/scene/server/scene-folder-repository.server'
import {
	buildEmbedSceneManifest,
	buildSceneManifest,
	buildSceneManifestEtag
} from '../../lib/domain/scene/server/scene-manifest.server'
import {
	getPublishedScenePreview,
	toPublishedModelRow
} from '../../lib/domain/scene/server/scene-preview-repository.server'
import * as sceneSettingsOps from '../../lib/domain/scene/server/scene-settings.operations.server'
import { SceneSettingsParser } from '../../lib/domain/scene/server/scene-settings.parser.server'
import { getAuthUser } from '../../lib/http/auth.server'
import {
	ensureSameOriginMutation,
	ensureValidCsrfToken
} from '../../lib/http/csrf.server'
import { ensurePost, parseActionRequest } from '../../lib/http/requests.server'
import { reportServerError } from '../../lib/observability/report-server-error.server'

import type { PublishedModelRow } from '../../lib/domain/scene/embed-asset-policy'
import type { SceneSettingsAction } from '../../types/api'

function withNoStoreHeaders(response: Response): Response {
	const headers = new Headers(response.headers)
	headers.set('Cache-Control', 'no-store')
	return new Response(response.body, {
		status: response.status,
		headers
	})
}

function withManifestCacheHeaders(
	response: Response,
	etag: string | null
): Response {
	const headers = new Headers(response.headers)
	headers.set('Cache-Control', 'private, no-cache')
	if (etag) headers.set('ETag', etag)
	return new Response(response.body, { status: response.status, headers })
}

function withAdditionalHeaders(
	response: Response,
	additionalHeaders?: HeadersInit
): Response {
	if (!additionalHeaders) {
		return response
	}

	const headers = new Headers(response.headers)
	new Headers(additionalHeaders).forEach((value, key) => {
		if (key.toLowerCase() === 'set-cookie') {
			headers.append(key, value)
			return
		}

		headers.set(key, value)
	})

	return new Response(response.body, {
		status: response.status,
		headers
	})
}

const MAX_IN_FLIGHT_HEAVY_SCENE_ACTIONS = 2
const inFlightGetSceneSettingsRequests = new Map<string, Promise<Response>>()

function getSceneSettingsRequestKey(scope: string, sceneId: string): string {
	return `${scope}:${sceneId}`
}

async function runWithSceneSettingsCoalescing(
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

async function runWithHeavySceneActionLimit(
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

async function runWithSceneWriteLock(
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

async function runWithIdempotentSceneRequest(params: {
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

async function authorizePreviewRequest(request: Request, projectId: string) {
	const hasTokenCredential =
		Boolean(new URL(request.url).searchParams.get('token')?.trim()) ||
		Boolean(request.headers.get('authorization')?.trim())

	if (hasTokenCredential) {
		const validation = await validatePreviewApiKeyForProject({
			request,
			projectId
		})

		if (!validation.ok) {
			if (validation.error === 'rate_limited') {
				return withNoStoreHeaders(ApiResponse.error('Too many requests', 429))
			}
			if (validation.error === 'domain_not_allowed') {
				return withNoStoreHeaders(ApiResponse.forbidden('Forbidden'))
			}

			return withNoStoreHeaders(ApiResponse.notFound('Scene not found'))
		}

		return { mode: 'apiKey' as const, userId: null }
	}

	const sessionAuth = await getAuthUser(request)
	if (sessionAuth instanceof Response) {
		return withNoStoreHeaders(ApiResponse.notFound('Scene not found'))
	}

	const project = await getProject(projectId, sessionAuth.user.id)
	if (!project) {
		return withNoStoreHeaders(ApiResponse.notFound('Scene not found'))
	}

	return {
		mode: 'session' as const,
		userId: sessionAuth.user.id,
		headers: sessionAuth.headers
	}
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const isPreviewRequest = url.searchParams.get('preview') === '1'
	const previewProjectId = url.searchParams.get('projectId')?.trim() || null

	if (isPreviewRequest) {
		const sceneId = params.sceneId?.trim()
		if (!sceneId) {
			return withNoStoreHeaders(ApiResponse.badRequest('Scene ID is required'))
		}

		if (!previewProjectId) {
			return withNoStoreHeaders(
				ApiResponse.badRequest('Project ID is required')
			)
		}

		const authContext = await authorizePreviewRequest(request, previewProjectId)
		if (authContext instanceof Response) {
			return authContext
		}

		let publishedModelRow: PublishedModelRow | null = null

		if (authContext.mode === 'apiKey') {
			const previewScene = await getPublishedScenePreview(
				previewProjectId,
				sceneId
			)
			if (!previewScene) {
				return withNoStoreHeaders(ApiResponse.notFound('Scene not found'))
			}
			publishedModelRow = toPublishedModelRow(previewScene)
		} else {
			const scene = await getScene(sceneId, authContext.userId)
			if (!scene || scene.projectId !== previewProjectId) {
				return withNoStoreHeaders(ApiResponse.notFound('Scene not found'))
			}
		}

		const token = url.searchParams.get('token')?.trim() || null
		const buildPreviewAssetUrl = (assetId: string) => {
			const assetParams = new URLSearchParams({
				preview: '1',
				projectId: previewProjectId
			})
			if (token) assetParams.set('token', token)
			return `/api/scenes/${sceneId}/assets/${assetId}?${assetParams.toString()}`
		}

		try {
			const manifest = publishedModelRow
				? await buildEmbedSceneManifest(
						sceneId,
						publishedModelRow,
						buildPreviewAssetUrl
					)
				: await buildSceneManifest(sceneId, buildPreviewAssetUrl)
			const etag = buildSceneManifestEtag(
				sceneId,
				manifest.settingsUpdatedAt,
				publishedModelRow ? 'embed' : 'session'
			)

			if (etag && request.headers.get('If-None-Match') === etag) {
				if (authContext.mode === 'session') {
					return withManifestCacheHeaders(
						new Response(null, {
							status: 304,
							headers: new Headers(authContext.headers)
						}),
						etag
					)
				}
				return withManifestCacheHeaders(
					new Response(null, { status: 304 }),
					etag
				)
			}

			if (authContext.mode === 'session') {
				return withManifestCacheHeaders(
					ApiResponse.success(manifest, 200, {
						headers: new Headers(authContext.headers)
					}),
					etag
				)
			}

			return withManifestCacheHeaders(ApiResponse.success(manifest), etag)
		} catch (error) {
			reportServerError(error, {
				request,
				properties: { sceneId, projectId: previewProjectId }
			})
			return withNoStoreHeaders(ApiResponse.serverError('Failed to load scene'))
		}
	}

	const authResult = await getAuthUser(request)
	if (authResult instanceof Response) {
		return authResult
	}

	const sceneId = params.sceneId?.trim()
	if (!sceneId) {
		return ApiResponse.error('Scene ID is required', 400, {
			headers: new Headers(authResult.headers)
		})
	}

	const scene = await getScene(sceneId, authResult.user.id)
	if (!scene) {
		return ApiResponse.notFound(`Scene not found with ID: ${sceneId}`, {
			headers: new Headers(authResult.headers)
		})
	}

	try {
		const manifest = await buildSceneManifest(
			sceneId,
			(assetId) => `/api/scenes/${sceneId}/assets/${assetId}`
		)
		const etag = buildSceneManifestEtag(sceneId, manifest.settingsUpdatedAt)

		if (etag && request.headers.get('If-None-Match') === etag) {
			return withManifestCacheHeaders(
				new Response(null, {
					status: 304,
					headers: new Headers(authResult.headers)
				}),
				etag
			)
		}

		return withManifestCacheHeaders(
			ApiResponse.success(manifest, 200, {
				headers: new Headers(authResult.headers)
			}),
			etag
		)
	} catch (error) {
		reportServerError(error, {
			request,
			properties: { sceneId, userId: authResult.user.id }
		})
		return ApiResponse.error(
			error instanceof Error ? error.message : 'Failed to load scene',
			500,
			{ headers: new Headers(authResult.headers) }
		)
	}
}

export async function action({ request, params }: ActionFunctionArgs) {
	const methodCheck = ensurePost(request)
	if (methodCheck) return methodCheck

	const csrfCheck = ensureSameOriginMutation(request)
	if (csrfCheck) {
		return csrfCheck
	}

	const url = new URL(request.url)
	const isPreviewRequest = url.searchParams.get('preview') === '1'
	const previewProjectId = url.searchParams.get('projectId')?.trim() || null

	const routeSceneId = params.sceneId?.trim()
	const actionRequest = await parseActionRequest(request)
	const rawAction = actionRequest.action
	const action = typeof rawAction === 'string' ? rawAction.trim() : ''

	if (!action) {
		return ApiResponse.badRequest('Action is required')
	}

	if (isPreviewRequest) {
		if (action !== 'get-scene-settings') {
			return withNoStoreHeaders(ApiResponse.forbidden('Forbidden'))
		}

		if (!routeSceneId) {
			return withNoStoreHeaders(ApiResponse.badRequest('Scene ID is required'))
		}

		if (!previewProjectId) {
			return withNoStoreHeaders(
				ApiResponse.badRequest('Project ID is required')
			)
		}

		const authContext = await authorizePreviewRequest(request, previewProjectId)
		if (authContext instanceof Response) {
			return authContext
		}

		const previewSessionHeaders =
			authContext.mode === 'session' ? authContext.headers : undefined

		/*
		  Token callers get the GET manifest and nothing else.

		  `getSceneSettings` returns every editor asset base64-inlined plus the
		  full glTF document, which is exactly what the embed manifest is built
		  to withhold. The client's `fetchManifestPayload` falls back to this
		  POST whenever a manifest fails its shape check, so leaving it open to
		  an API key would let the embed quietly re-acquire the editor payload
		  the moment the manifest stopped carrying it.
		*/
		if (authContext.mode === 'apiKey') {
			return withNoStoreHeaders(ApiResponse.forbidden('Forbidden'))
		}

		{
			const scene = await getScene(routeSceneId, authContext.userId)
			if (!scene || scene.projectId !== previewProjectId) {
				return withNoStoreHeaders(ApiResponse.notFound('Scene not found'))
			}
		}

		const parsedRequest =
			SceneSettingsParser.parseSceneSettingsRequestData(actionRequest)
		if (parsedRequest instanceof Response) {
			return withNoStoreHeaders(
				withAdditionalHeaders(parsedRequest, previewSessionHeaders)
			)
		}

		const effectiveSceneId = parsedRequest.sceneId?.trim() || routeSceneId
		const requestKey = getSceneSettingsRequestKey(
			`preview-session-${authContext.userId}`,
			effectiveSceneId
		)

		const response = await runWithSceneSettingsCoalescing(requestKey, () =>
			sceneSettingsOps.getSceneSettings({
				...parsedRequest,
				action,
				sceneId: effectiveSceneId
			})
		)

		return withNoStoreHeaders(
			withAdditionalHeaders(response, previewSessionHeaders)
		)
	}

	const authResult = await getAuthUser(request)
	if (authResult instanceof Response) {
		return authResult
	}

	const authHeaders = authResult.headers

	if (action === 'update-scene-metadata') {
		/*
		  Token CSRF, not just the route's origin check.

		  This was the last dashboard mutation posting without a token at all, and
		  `ensureSameOriginMutation` passes when both `Origin` and `Referer` are
		  absent. Scoped to this action rather than the whole route: the other
		  actions here have their own callers to migrate.
		*/
		const tokenCheck = await ensureValidCsrfToken(request, actionRequest.csrf)
		if (tokenCheck) {
			return withAdditionalHeaders(tokenCheck, authHeaders)
		}

		if (!routeSceneId) {
			return withAdditionalHeaders(
				ApiResponse.badRequest('Scene ID is required'),
				authHeaders
			)
		}

		const scene = await getScene(routeSceneId, authResult.user.id)
		if (!scene) {
			return withAdditionalHeaders(
				ApiResponse.notFound(`Scene not found with ID: ${routeSceneId}`),
				authHeaders
			)
		}

		const nameRaw = actionRequest.name
		const descriptionRaw = actionRequest.description

		const name = typeof nameRaw === 'string' ? nameRaw.trim() : ''
		const description =
			typeof descriptionRaw === 'string' ? descriptionRaw : null

		if (!name) {
			return withAdditionalHeaders(
				ApiResponse.badRequest('Scene name is required'),
				authHeaders
			)
		}

		try {
			const updatedScene = await updateSceneMetadata(
				routeSceneId,
				authResult.user.id,
				{
					name,
					description
				}
			)

			return withAdditionalHeaders(
				ApiResponse.success({
					success: true,
					action,
					scene: updatedScene
				}),
				authHeaders
			)
		} catch (error) {
			return withAdditionalHeaders(
				ApiResponse.serverError(
					error instanceof Error
						? error.message
						: 'Failed to update scene metadata'
				),
				authHeaders
			)
		}
	}

	const uploadOrPrepareAction =
		action === 'prepare-scene-upload' ||
		action === 'upload-scene-asset' ||
		action === 'upload-scene-gltf' ||
		action === 'upload-published-glb'

	const parsedRequest = uploadOrPrepareAction
		? {
				action,
				requestId:
					typeof actionRequest.requestId === 'string'
						? actionRequest.requestId.trim()
						: undefined,
				projectId:
					typeof actionRequest.projectId === 'string'
						? actionRequest.projectId.trim() || undefined
						: undefined,
				sceneId:
					typeof actionRequest.sceneId === 'string'
						? actionRequest.sceneId.trim() || undefined
						: routeSceneId,
				targetProjectId:
					typeof actionRequest.targetProjectId === 'string'
						? actionRequest.targetProjectId.trim() || undefined
						: undefined,
				targetFolderId:
					typeof actionRequest.targetFolderId === 'string'
						? actionRequest.targetFolderId.trim() || null
						: undefined,
				currentSceneBytes: parseSceneBytes(actionRequest.currentSceneBytes)
			}
		: SceneSettingsParser.parseSceneSettingsRequestData(actionRequest)

	if (parsedRequest instanceof Response) {
		return withAdditionalHeaders(parsedRequest, authHeaders)
	}

	const effectiveSceneId = parsedRequest.sceneId?.trim() || routeSceneId
	const requestData = {
		...parsedRequest,
		sceneId: effectiveSceneId
	}

	if (
		effectiveSceneId &&
		(action === 'get-scene-settings' ||
			action === 'commit-scene-publish' ||
			action === 'revoke-scene-publish')
	) {
		const scene = await getScene(effectiveSceneId, authResult.user.id)
		if (!scene) {
			return withAdditionalHeaders(
				ApiResponse.notFound(`Scene not found with ID: ${effectiveSceneId}`),
				authHeaders
			)
		}
	}

	if (action === 'commit-scene-save') {
		console.info('[scenes] save request received', {
			requestId: requestData.requestId,
			userId: authResult.user.id,
			sceneId: requestData.sceneId || null
		})
	}

	try {
		switch (action as SceneSettingsAction) {
			case 'prepare-scene-upload': {
				try {
					return withAdditionalHeaders(
						ApiResponse.success(
							await sceneSettingsOps.prepareSceneUpload(
								{
									...requestData,
									action
								},
								authResult.user.id
							)
						),
						authHeaders
					)
				} catch (err) {
					if (err instanceof EntitlementRequiredError) {
						/*
						  Read-only billing is a payment, not an upgrade: the plan still
						  grants the entitlement and the account has simply stopped paying
						  for it. Sending 403 there tells the owner to buy something they
						  already own.
						*/
						return withAdditionalHeaders(
							isBillingStateReadOnly(err.billingState)
								? ApiResponse.paymentRequired(err.message)
								: ApiResponse.forbidden(err.message),
							authHeaders
						)
					}
					if (err instanceof QuotaExceededError) {
						return withAdditionalHeaders(
							ApiResponse.quotaExceeded(err.message, {
								limitKey: err.limitKey,
								currentValue: err.currentValue,
								limit: err.limit,
								plan: err.plan,
								upgradeTo: err.upgradeTo
							}),
							authHeaders
						)
					}
					throw err
				}
			}

			case 'upload-scene-asset': {
				const file = actionRequest.file
				const kindRaw = actionRequest.kind
				const kind = kindRaw === 'image' ? 'image' : 'buffer'

				if (!(file instanceof File)) {
					return withAdditionalHeaders(
						ApiResponse.badRequest('file is required for upload-scene-asset'),
						authHeaders
					)
				}

				return withAdditionalHeaders(
					await sceneSettingsOps.uploadSceneAsset(
						{ ...requestData, action },
						authResult.user.id,
						file,
						kind
					),
					authHeaders
				)
			}

			case 'upload-scene-gltf': {
				const file = actionRequest.file
				if (!(file instanceof File)) {
					return withAdditionalHeaders(
						ApiResponse.badRequest('file is required for upload-scene-gltf'),
						authHeaders
					)
				}

				return withAdditionalHeaders(
					await sceneSettingsOps.uploadSceneGltf(
						{ ...requestData, action },
						authResult.user.id,
						file
					),
					authHeaders
				)
			}

			case 'upload-published-glb': {
				const file = actionRequest.file
				if (!(file instanceof File)) {
					return withAdditionalHeaders(
						ApiResponse.badRequest('file is required for upload-published-glb'),
						authHeaders
					)
				}

				return withAdditionalHeaders(
					await sceneSettingsOps.uploadPublishedGlb(
						{ ...requestData, action },
						authResult.user.id,
						file
					),
					authHeaders
				)
			}

			case 'commit-scene-save':
				return withAdditionalHeaders(
					await runWithIdempotentSceneRequest({
						requestId: requestData.requestId,
						userId: authResult.user.id,
						action,
						sceneId: requestData.sceneId,
						operation: () =>
							runWithHeavySceneActionLimit(() =>
								runWithSceneWriteLock(
									requestData.sceneId as string,
									`${authResult.user.id}:${requestData.requestId ?? 'no-request-id'}`,
									() =>
										sceneSettingsOps.saveSceneSettings(
											{
												...requestData,
												action
											},
											authResult.user.id
										)
								)
							)
					}),
					authHeaders
				)

			case 'get-scene-settings':
				if (!requestData.sceneId) {
					return withAdditionalHeaders(
						ApiResponse.badRequest('Scene ID is required'),
						authHeaders
					)
				}

				return withAdditionalHeaders(
					await runWithSceneSettingsCoalescing(
						getSceneSettingsRequestKey(authResult.user.id, requestData.sceneId),
						() =>
							sceneSettingsOps.getSceneSettings({
								...requestData,
								action
							})
					),
					authHeaders
				)

			case 'commit-scene-publish':
				return withAdditionalHeaders(
					await runWithIdempotentSceneRequest({
						requestId: requestData.requestId,
						userId: authResult.user.id,
						action,
						sceneId: requestData.sceneId,
						operation: () =>
							runWithHeavySceneActionLimit(() =>
								runWithSceneWriteLock(
									requestData.sceneId as string,
									`${authResult.user.id}:${requestData.requestId ?? 'no-request-id'}`,
									() =>
										sceneSettingsOps.publishScene(
											{
												...requestData,
												action
											},
											authResult.user.id
										)
								)
							)
					}),
					authHeaders
				)

			case 'revoke-scene-publish':
				return withAdditionalHeaders(
					await runWithIdempotentSceneRequest({
						requestId: requestData.requestId,
						userId: authResult.user.id,
						action,
						sceneId: requestData.sceneId,
						operation: () =>
							runWithHeavySceneActionLimit(() =>
								runWithSceneWriteLock(
									requestData.sceneId as string,
									`${authResult.user.id}:${requestData.requestId ?? 'no-request-id'}`,
									() =>
										sceneSettingsOps.revokeScenePublish(
											{
												...requestData,
												action
											},
											authResult.user.id
										)
								)
							)
					}),
					authHeaders
				)

			default:
				return withAdditionalHeaders(
					ApiResponse.badRequest(`Unknown action: ${action}`),
					authHeaders
				)
		}
	} catch (error) {
		if (error instanceof EntitlementRequiredError) {
			/*
			  Read-only billing is a payment, not an upgrade: the plan still
			  grants the entitlement and the account has simply stopped paying
			  for it. Sending 403 there tells the owner to buy something they
			  already own.
			*/
			return withAdditionalHeaders(
				isBillingStateReadOnly(error.billingState)
					? ApiResponse.paymentRequired(error.message)
					: ApiResponse.forbidden(error.message),
				authHeaders
			)
		}
		if (error instanceof QuotaExceededError) {
			return withAdditionalHeaders(
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

		reportServerError(error, {
			request,
			properties: {
				action,
				requestId: requestData.requestId,
				userId: authResult.user.id,
				sceneId: requestData.sceneId || null
			}
		})
		return withAdditionalHeaders(
			ApiResponse.serverError(
				error instanceof Error ? error.message : 'Operation failed'
			),
			authHeaders
		)
	}
}
