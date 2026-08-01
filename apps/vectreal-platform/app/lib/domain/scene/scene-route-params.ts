import { UUID_REGEX } from '../../../constants/utility-constants'

export interface SceneRouteParams {
	projectId: string
	sceneId: string
}

export type SceneRouteParamsResult =
	| { ok: true; value: SceneRouteParams }
	| { ok: false; reason: 'missing' | 'malformed' }

/**
 * Validate the `:projectId` / `:sceneId` pair shared by the `/embed` and
 * `/preview` routes.
 *
 * Both ids reach Postgres as uuid-typed query parameters, so a malformed value
 * raises a driver error (`invalid input syntax for type uuid`) instead of
 * returning no rows. That surfaces as a 500 on input anyone can send, so the
 * shape is checked before any query runs.
 */
export function parseSceneRouteParams(params: {
	projectId?: string
	sceneId?: string
}): SceneRouteParamsResult {
	const projectId = params.projectId?.trim()
	const sceneId = params.sceneId?.trim()

	if (!projectId || !sceneId) {
		return { ok: false, reason: 'missing' }
	}

	if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(sceneId)) {
		return { ok: false, reason: 'malformed' }
	}

	return { ok: true, value: { projectId, sceneId } }
}

export const SCENE_ROUTE_PARAM_ERRORS = {
	missing: 'Project ID and Scene ID are required',
	malformed: 'Project ID and Scene ID must be valid UUIDs'
} as const
