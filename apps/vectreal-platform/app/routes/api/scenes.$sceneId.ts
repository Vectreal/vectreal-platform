import { ApiResponse } from '@shared/utils'
import { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'

import { UUID_REGEX } from '../../constants/utility-constants'
import { authorizePreviewRequest } from '../../lib/domain/auth/preview-request-auth.server'
import { billingRefusalResponse } from '../../lib/domain/billing/billing-refusal-response'
import { canPerformDashboardOperation } from '../../lib/domain/dashboard/dashboard-operations'
import { resolveSceneMembership } from '../../lib/domain/dashboard/dashboard-permissions.server'
import { createEmbedAssetUrls } from '../../lib/domain/embed/embed-asset-signature.server'
import { buildPreviewAssetUrl } from '../../lib/domain/scene/client/preview-scene-endpoint'
import { normalizePresentationSettings } from '../../lib/domain/scene/scene-presentation'
import {
	getScene,
	updateSceneMetadata
} from '../../lib/domain/scene/server/scene-folder-repository.server'
import {
	buildSceneManifestEtag,
	type ManifestPublication
} from '../../lib/domain/scene/server/scene-manifest-etag'
import { chooseSceneManifestKind } from '../../lib/domain/scene/server/scene-manifest-kind'
import {
	buildEmbedSceneManifest,
	buildSceneManifest
} from '../../lib/domain/scene/server/scene-manifest.server'
import {
	getPublishedScenePreview,
	toPublishedModelRow
} from '../../lib/domain/scene/server/scene-preview-repository.server'
import {
	getSceneSettingsRequestKey,
	runGuardedSceneMutation,
	runWithSceneSettingsCoalescing,
	runWithSceneWriteLock
} from '../../lib/domain/scene/server/scene-request-guards.server'
import { updateScenePresentation } from '../../lib/domain/scene/server/scene-settings-repository.server'
import * as sceneSettingsOps from '../../lib/domain/scene/server/scene-settings.operations.server'
import { SceneSettingsParser } from '../../lib/domain/scene/server/scene-settings.parser.server'
import { getAuthUser } from '../../lib/http/auth.server'
import {
	ensureSameOriginMutation,
	ensureValidCsrfToken
} from '../../lib/http/csrf.server'
import { ensurePost, parseActionRequest } from '../../lib/http/requests.server'
import {
	manifestResponse,
	withNoStore
} from '../../lib/http/response-headers.server'
import { reportServerError } from '../../lib/observability/report-server-error.server'

import type { SceneSettingsAction } from '../../types/api'

/**
 * Whether the route names a scene id no row could have.
 *
 * `:sceneId` reaches uuid columns on every path below, and Postgres rejects a
 * malformed one outright instead of matching nothing, which surfaced as a 500.
 * It names no scene, so it gets the same 404 an unknown id gets. Absent is
 * not malformed: a first save posts to `/api/scenes` with no id at all.
 */
function isMalformedSceneId(sceneId: string | undefined): boolean {
	return Boolean(sceneId) && !UUID_REGEX.test(sceneId as string)
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const isPreviewRequest = url.searchParams.get('preview') === '1'
	const previewProjectId = url.searchParams.get('projectId')?.trim() || null

	if (isMalformedSceneId(params.sceneId?.trim())) {
		return withNoStore(ApiResponse.notFound('Scene not found'))
	}

	if (isPreviewRequest) {
		const sceneId = params.sceneId?.trim()
		if (!sceneId) {
			return withNoStore(ApiResponse.badRequest('Scene ID is required'))
		}

		if (!previewProjectId) {
			return withNoStore(ApiResponse.badRequest('Project ID is required'))
		}

		const authContext = await authorizePreviewRequest(request, previewProjectId)
		if (authContext instanceof Response) {
			return authContext
		}

		if (authContext.mode === 'session') {
			const membership = await resolveSceneMembership(
				sceneId,
				authContext.userId
			)
			if (!membership || membership.projectId !== previewProjectId) {
				return withNoStore(ApiResponse.notFound('Scene not found'))
			}
		}

		const previewScene = await getPublishedScenePreview(
			previewProjectId,
			sceneId
		)
		const manifestKind = chooseSceneManifestKind({
			hasPublication: previewScene !== null,
			caller: authContext.mode
		})
		if (manifestKind === 'not-found') {
			return withNoStore(ApiResponse.notFound('Scene not found'))
		}

		const publishedModelRow =
			manifestKind === 'embed' && previewScene
				? toPublishedModelRow(previewScene)
				: null
		/*
		  Signed only for the published set: the working manifest describes the
		  draft, whose assets must not become publicly cacheable URLs. A member
		  gets no token in theirs - unsigned, they authenticate by cookie.
		*/
		const embedAssetUrls = publishedModelRow
			? createEmbedAssetUrls({
					sceneId,
					projectId: previewProjectId,
					token:
						authContext.mode === 'apiKey'
							? url.searchParams.get('token')?.trim() || null
							: null
				})
			: null
		const buildAssetUrl =
			embedAssetUrls?.buildAssetUrl ??
			((assetId: string) =>
				buildPreviewAssetUrl({ sceneId, projectId: previewProjectId, assetId }))
		const publication: ManifestPublication | null =
			previewScene && embedAssetUrls
				? {
						assetId: previewScene.publishedAssetId,
						publishedAt: previewScene.publishedAt,
						assetUrlsVersion: embedAssetUrls.version,
						caller: authContext.mode
					}
				: null

		try {
			const manifest = publishedModelRow
				? await buildEmbedSceneManifest(
						sceneId,
						publishedModelRow,
						buildAssetUrl
					)
				: await buildSceneManifest(sceneId, buildAssetUrl)
			const etag = buildSceneManifestEtag(
				sceneId,
				manifest.settingsUpdatedAt,
				publication
			)

			return manifestResponse(request, manifest, etag)
		} catch (error) {
			reportServerError(error, {
				request,
				properties: { sceneId, projectId: previewProjectId }
			})
			return withNoStore(ApiResponse.serverError('Failed to load scene'))
		}
	}

	const authResult = await getAuthUser(request)
	if (authResult instanceof Response) {
		return authResult
	}

	const sceneId = params.sceneId?.trim()
	if (!sceneId) {
		return ApiResponse.error('Scene ID is required', 400)
	}

	const scene = await getScene(sceneId, authResult.user.id)
	if (!scene) {
		return ApiResponse.notFound(`Scene not found with ID: ${sceneId}`)
	}

	try {
		const manifest = await buildSceneManifest(
			sceneId,
			(assetId) => `/api/scenes/${sceneId}/assets/${assetId}`
		)
		const etag = buildSceneManifestEtag(sceneId, manifest.settingsUpdatedAt)

		return manifestResponse(request, manifest, etag)
	} catch (error) {
		reportServerError(error, {
			request,
			properties: { sceneId, userId: authResult.user.id }
		})
		return ApiResponse.error(
			error instanceof Error ? error.message : 'Failed to load scene',
			500
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
	if (isMalformedSceneId(routeSceneId)) {
		return withNoStore(ApiResponse.notFound('Scene not found'))
	}

	const actionRequest = await parseActionRequest(request)
	const rawAction = actionRequest.action
	const action = typeof rawAction === 'string' ? rawAction.trim() : ''

	if (!action) {
		return ApiResponse.badRequest('Action is required')
	}

	if (isPreviewRequest) {
		if (action !== 'get-scene-settings') {
			return withNoStore(ApiResponse.forbidden('Forbidden'))
		}

		if (!routeSceneId) {
			return withNoStore(ApiResponse.badRequest('Scene ID is required'))
		}

		if (!previewProjectId) {
			return withNoStore(ApiResponse.badRequest('Project ID is required'))
		}

		const authContext = await authorizePreviewRequest(request, previewProjectId)
		if (authContext instanceof Response) {
			return authContext
		}

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
			return withNoStore(ApiResponse.forbidden('Forbidden'))
		}

		{
			const scene = await getScene(routeSceneId, authContext.userId)
			if (!scene || scene.projectId !== previewProjectId) {
				return withNoStore(ApiResponse.notFound('Scene not found'))
			}
		}

		/*
		  The same rule as the GET: a published scene is shown as published, and
		  this POST only ever returns the working scene. It is the client's
		  fallback when a manifest fails its shape check, so answering it here
		  would quietly put the draft of a published scene on /preview or the
		  dashboard. The GET manifest is a published scene's only form.
		*/
		const previewScene = await getPublishedScenePreview(
			previewProjectId,
			routeSceneId
		)
		const manifestKind = chooseSceneManifestKind({
			hasPublication: previewScene !== null,
			caller: authContext.mode
		})
		if (manifestKind !== 'working') {
			return withNoStore(ApiResponse.notFound('Scene not found'))
		}

		const parsedRequest =
			SceneSettingsParser.parseSceneSettingsRequestData(actionRequest)
		if (parsedRequest instanceof Response) {
			return withNoStore(parsedRequest)
		}

		/*
		  Every check above is keyed on the route's scene, so the read is too. A
		  body naming another scene is refused rather than followed:
		  `getSceneSettings` checks nothing itself, so following it would hand a
		  member any scene's draft, in any project, through their own scene's URL.
		*/
		const bodySceneId = parsedRequest.sceneId?.trim()
		if (bodySceneId && bodySceneId !== routeSceneId) {
			return withNoStore(ApiResponse.notFound('Scene not found'))
		}

		const requestKey = getSceneSettingsRequestKey(
			`preview-session-${authContext.userId}`,
			routeSceneId
		)

		const response = await runWithSceneSettingsCoalescing(requestKey, () =>
			sceneSettingsOps.getSceneSettings({
				...parsedRequest,
				action,
				sceneId: routeSceneId
			})
		)

		return withNoStore(response)
	}

	const authResult = await getAuthUser(request)
	if (authResult instanceof Response) {
		return authResult
	}

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
			return tokenCheck
		}

		if (!routeSceneId) {
			return ApiResponse.badRequest('Scene ID is required')
		}

		const scene = await getScene(routeSceneId, authResult.user.id)
		if (!scene) {
			return ApiResponse.notFound(`Scene not found with ID: ${routeSceneId}`)
		}

		const nameRaw = actionRequest.name
		const descriptionRaw = actionRequest.description

		const name = typeof nameRaw === 'string' ? nameRaw.trim() : ''
		const description =
			typeof descriptionRaw === 'string' ? descriptionRaw : null

		if (!name) {
			return ApiResponse.badRequest('Scene name is required')
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

			return ApiResponse.success({
				success: true,
				action,
				scene: updatedScene
			})
		} catch (error) {
			return ApiResponse.serverError(
				error instanceof Error
					? error.message
					: 'Failed to update scene metadata'
			)
		}
	}

	if (action === 'update-scene-presentation') {
		/*
		  A single field written in place, so the dashboard can change how a
		  published scene presents itself without a full publisher save. Not a
		  `/api/dashboard/mutations` verb: that contract owns the scene's place
		  in the tree - create, rename, move, delete - and this is a scene
		  setting, which lives here beside the save that writes the rest.

		  Last write wins against a publisher tab holding older settings: its
		  next full save writes the whole presentation back.
		*/
		const tokenCheck = await ensureValidCsrfToken(request, actionRequest.csrf)
		if (tokenCheck) {
			return tokenCheck
		}

		if (!routeSceneId) {
			return ApiResponse.badRequest('Scene ID is required')
		}

		// One 404 for "no such scene" and "not yours to change", so the
		// endpoint confirms nothing about an id the caller cannot edit.
		const membership = await resolveSceneMembership(
			routeSceneId,
			authResult.user.id
		)
		if (
			!membership ||
			!canPerformDashboardOperation('scene:update', membership)
		) {
			return ApiResponse.notFound('Scene not found')
		}

		const presentation = normalizePresentationSettings(
			actionRequest.presentation
		)
		if (!presentation) {
			return ApiResponse.badRequest('Presentation settings are required')
		}

		try {
			return await runWithSceneWriteLock(
				routeSceneId,
				`${authResult.user.id}:update-scene-presentation`,
				async () => {
					const updated = await updateScenePresentation(
						routeSceneId,
						presentation
					)
					return updated
						? ApiResponse.success({ presentation: updated })
						: ApiResponse.notFound('Scene not found')
				}
			)
		} catch (error) {
			reportServerError(error, {
				request,
				properties: { action, sceneId: routeSceneId }
			})
			return ApiResponse.serverError('Failed to update presentation')
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
						: undefined
			}
		: SceneSettingsParser.parseSceneSettingsRequestData(actionRequest)

	if (parsedRequest instanceof Response) {
		return parsedRequest
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
			return ApiResponse.notFound(
				`Scene not found with ID: ${effectiveSceneId}`
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
					return ApiResponse.success(
						await sceneSettingsOps.prepareSceneUpload(
							{
								...requestData,
								action
							},
							authResult.user.id
						)
					)
				} catch (err) {
					const refusal = billingRefusalResponse(err)
					if (refusal) return refusal
					throw err
				}
			}

			case 'upload-scene-asset': {
				const file = actionRequest.file
				const kindRaw = actionRequest.kind
				const kind = kindRaw === 'image' ? 'image' : 'buffer'

				if (!(file instanceof File)) {
					return ApiResponse.badRequest(
						'file is required for upload-scene-asset'
					)
				}

				return await sceneSettingsOps.uploadSceneAsset(
					{ ...requestData, action },
					authResult.user.id,
					file,
					kind
				)
			}

			case 'upload-scene-gltf': {
				const file = actionRequest.file
				if (!(file instanceof File)) {
					return ApiResponse.badRequest(
						'file is required for upload-scene-gltf'
					)
				}

				return await sceneSettingsOps.uploadSceneGltf(
					{ ...requestData, action },
					authResult.user.id,
					file
				)
			}

			case 'upload-published-glb': {
				const file = actionRequest.file
				if (!(file instanceof File)) {
					return ApiResponse.badRequest(
						'file is required for upload-published-glb'
					)
				}

				return await sceneSettingsOps.uploadPublishedGlb(
					{ ...requestData, action },
					authResult.user.id,
					file
				)
			}

			case 'commit-scene-save':
				return await runGuardedSceneMutation({
					requestId: requestData.requestId,
					userId: authResult.user.id,
					action,
					sceneId: requestData.sceneId,
					operation: () =>
						sceneSettingsOps.saveSceneSettings(
							{ ...requestData, action },
							authResult.user.id
						)
				})

			case 'get-scene-settings':
				if (!requestData.sceneId) {
					return ApiResponse.badRequest('Scene ID is required')
				}

				return await runWithSceneSettingsCoalescing(
					getSceneSettingsRequestKey(authResult.user.id, requestData.sceneId),
					() =>
						sceneSettingsOps.getSceneSettings({
							...requestData,
							action
						})
				)

			case 'commit-scene-publish':
				return await runGuardedSceneMutation({
					requestId: requestData.requestId,
					userId: authResult.user.id,
					action,
					sceneId: requestData.sceneId,
					operation: () =>
						sceneSettingsOps.publishScene(
							{ ...requestData, action },
							authResult.user.id
						)
				})

			case 'revoke-scene-publish':
				return await runGuardedSceneMutation({
					requestId: requestData.requestId,
					userId: authResult.user.id,
					action,
					sceneId: requestData.sceneId,
					operation: () =>
						sceneSettingsOps.revokeScenePublish(
							{ ...requestData, action },
							authResult.user.id
						)
				})

			default:
				return ApiResponse.badRequest(`Unknown action: ${action}`)
		}
	} catch (error) {
		const refusal = billingRefusalResponse(error)
		if (refusal) return refusal

		reportServerError(error, {
			request,
			properties: {
				action,
				requestId: requestData.requestId,
				userId: authResult.user.id,
				sceneId: requestData.sceneId || null
			}
		})
		return ApiResponse.serverError(
			error instanceof Error ? error.message : 'Operation failed'
		)
	}
}
