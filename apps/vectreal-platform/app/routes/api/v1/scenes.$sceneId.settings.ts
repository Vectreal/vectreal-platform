/**
 * GET   /api/v1/scenes/:sceneId/settings  every settings section, defaults
 *                                         filled in. Needs `projects:read`.
 * PATCH /api/v1/scenes/:sceneId/settings  replaces the look sections the JSON
 *                                         body names (environment, controls,
 *                                         bounds, shadows, presentation); the
 *                                         others stay as stored. Needs
 *                                         `scenes:write` and an
 *                                         `Idempotency-Key`.
 *
 * Both answer 200 `{ settings }`, PATCH with the settings as stored.
 *
 * A PATCH is a save like the publisher's: the merged document goes through
 * the same parser, and live embeds show it at once. It never touches the
 * scene's model, files, name, thumbnail or shadow bake. It
 * takes the scene's write lock, so a publisher save running at the same
 * moment makes it answer 409 `scene_busy` rather than interleave.
 */

import { ApiResponse } from '@shared/utils'
import { updateSceneSettingsInputSchema } from '@vctrl/sdk'

import { withSceneSettingsDefaults } from '../../../constants/viewer-defaults'
import { getDbClient } from '../../../db/client'
import { agentApiError } from '../../../lib/domain/agent/agent-api-response'
import { recordAgentAudit } from '../../../lib/domain/agent/agent-audit.server'
import { withIdempotency } from '../../../lib/domain/agent/agent-idempotency.server'
import { AGENT_OPERATION_SCOPES } from '../../../lib/domain/agent/agent-operation-scopes'
import { authorizeAgentRequest } from '../../../lib/domain/agent/agent-request.server'
import { resolveAgentScene } from '../../../lib/domain/agent/agent-resource.server'
import { applySceneSettingsPatch } from '../../../lib/domain/scene/scene-settings-patch'
import { runWithSceneWriteLock } from '../../../lib/domain/scene/server/scene-request-guards.server'
import { checkHotspotArtwork } from '../../../lib/domain/scene/server/scene-settings-hotspots.parser.server'
import { parseSettingsData } from '../../../lib/domain/scene/server/scene-settings-payload.parser.server'
import {
	SceneSaveRefusedError,
	sceneSettingsService
} from '../../../lib/domain/scene/server/scene-settings-service.server'

import type { Route } from './+types/scenes.$sceneId.settings'
import type { SceneSettings } from '@vctrl/core'
import type { SceneSettingsDocument } from '@vctrl/sdk'

export async function loader({ request, params }: Route.LoaderArgs) {
	const actor = await authorizeAgentRequest(request, {
		scope: AGENT_OPERATION_SCOPES['scene:read']
	})
	const { sceneId } = await resolveAgentScene(
		params.sceneId,
		actor,
		'scene:read'
	)

	const stored = await getDbClient().transaction((tx) =>
		sceneSettingsService.readSceneSettingsWithin(tx, sceneId)
	)
	if (!stored) throw agentApiError(404, 'not_found', 'No such scene.')

	return settingsResponse(stored.settings)
}

export async function action({ request, params }: Route.ActionArgs) {
	// Gated before the method is read, so a caller without a token learns
	// nothing about the route.
	const actor = await authorizeAgentRequest(request, {
		scope: AGENT_OPERATION_SCOPES['scene:update']
	})
	if (request.method !== 'PATCH') {
		return agentApiError(
			405,
			'method_not_allowed',
			'This route answers GET and PATCH.',
			{ headers: { Allow: 'GET, PATCH' } }
		)
	}

	const { sceneId, projectId } = await resolveAgentScene(
		params.sceneId,
		actor,
		'scene:update'
	)

	const body: unknown = await request.json().catch(() => undefined)
	const input = updateSceneSettingsInputSchema.safeParse(body)
	if (!input.success) {
		throw agentApiError(
			400,
			'invalid_request',
			'Send a JSON object of settings sections, such as {"environment": {"preset": "studio-soft"}}. Each section sent replaces the stored one.',
			{ extra: { issues: input.error.issues } }
		)
	}
	const patch = input.data

	return runWithSceneWriteLock(
		sceneId,
		`agent:${actor.grantId}:${crypto.randomUUID()}`,
		() =>
			withIdempotency(
				{ grantId: actor.grantId, request, payload: { sceneId, patch } },
				async (tx) => {
					const stored = await sceneSettingsService.readSceneSettingsWithin(
						tx,
						sceneId
					)
					if (!stored) return agentApiError(404, 'not_found', 'No such scene.')

					// Patched over the scene as served, the document the publisher
					// loads and saves back, so a PATCH stores what a publisher save of
					// the same scene would: a legacy shadow row is normalized the way
					// every read shows it, not re-saved raw.
					const settings = parseSettingsData({
						settings: applySceneSettingsPatch(asServed(stored.settings), patch)
					})
					if (settings instanceof Response) return asAgentRefusal(settings)
					// The publisher's save runs this too: hotspot artwork may only
					// name an asset this scene links.
					const artworkRefusal = checkHotspotArtwork(
						settings.hotspots,
						sceneId,
						stored.sceneAssetIds
					)
					if (artworkRefusal) return asAgentRefusal(artworkRefusal)

					try {
						// Every link as it is, so nothing is unlinked and nothing needs
						// collecting after the commit.
						await sceneSettingsService.saveSceneSettingsWithin(tx, {
							sceneId,
							projectId,
							userId: actor.userId,
							// A blank name leaves the scene's name alone.
							meta: { name: '', description: '', thumbnailUrl: '' },
							settings,
							sceneAssetIds: stored.sceneAssetIds,
							sourceAssetId: stored.sourceAssetId
						})
					} catch (error) {
						if (!(error instanceof SceneSaveRefusedError)) throw error
						return agentApiError(400, 'invalid_request', error.message)
					}
					await recordAgentAudit(tx, actor, 'scene:update', sceneId)

					const saved = await sceneSettingsService.readSceneSettingsWithin(
						tx,
						sceneId
					)
					return settingsResponse(saved?.settings ?? settings)
				}
			),
		() =>
			agentApiError(
				409,
				'scene_busy',
				'The scene is being saved right now. Retry with the same Idempotency-Key in a moment.',
				{ headers: { 'Retry-After': '1' } }
			)
	)
}

/** A save parser's 400 in the v1 shape, so an agent can branch on its code. */
async function asAgentRefusal(refusal: Response): Promise<Response> {
	const { error } = (await refusal.json()) as { error: string }
	return agentApiError(400, 'invalid_request', error)
}

/** A scene's settings as the publisher and every viewer read them. */
function asServed(settings: SceneSettings): SceneSettings {
	return { ...withSceneSettingsDefaults(settings), hotspots: settings.hotspots }
}

function settingsResponse(settings: SceneSettings): Response {
	const served = asServed(settings)
	// Core's section types are what the contract carries as JSON objects; the
	// SDK spec parses this exact shape.
	const document = {
		settings: { ...served, hotspots: served.hotspots ?? [] }
	} as unknown as SceneSettingsDocument
	return ApiResponse.success(document, 200, {
		headers: { 'Cache-Control': 'no-store' }
	})
}
