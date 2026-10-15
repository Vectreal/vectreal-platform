import { createEmbedAssetUrls } from './embed-asset-signature.server'
import { reportServerError } from '../../observability/report-server-error.server'
import {
	composeEmbedSceneManifest,
	type EmbedSceneSettings
} from '../scene/server/scene-manifest.server'
import {
	toPublishedModelRow,
	type PublishedScenePreview
} from '../scene/server/scene-preview-repository.server'

import type { SceneEmbedManifestResponse } from '../../../types/api'

/**
 * A settings read that failed, held as a value so a loader can read settings
 * alongside its other queries and decide what the failure means afterwards.
 */
export class EmbedSettingsReadFailure {
	constructor(readonly cause: unknown) {}
}

/**
 * The scene manifest, served with the document so the page starts loading
 * the model the moment it hydrates instead of asking for the manifest first.
 *
 * Null when it cannot be served inline, and the client then fetches it the
 * way it always has: when building it fails, or when its asset URLs could not
 * authenticate. Unsigned URLs carry a key only when one arrived in the query,
 * so a third-party page with neither a signature nor a token in its URLs has
 * no credential at all. A signed-in page does: its unsigned URLs authenticate
 * by cookie, which is what `allowUnsignedWithoutToken` says.
 */
export async function buildInlineEmbedManifest(
	request: Request,
	params: {
		projectId: string
		sceneId: string
		previewScene: PublishedScenePreview
		settingsData: EmbedSceneSettings | EmbedSettingsReadFailure
		token: string | null
		allowUnsignedWithoutToken: boolean
	}
): Promise<SceneEmbedManifestResponse | null> {
	const {
		projectId,
		sceneId,
		previewScene,
		settingsData,
		token,
		allowUnsignedWithoutToken
	} = params
	const assetUrls = createEmbedAssetUrls({ sceneId, projectId, token })
	if (assetUrls.version === null && !token && !allowUnsignedWithoutToken) {
		return null
	}

	try {
		if (settingsData instanceof EmbedSettingsReadFailure) {
			throw settingsData.cause
		}
		return await composeEmbedSceneManifest(
			sceneId,
			toPublishedModelRow(previewScene),
			settingsData,
			assetUrls.buildAssetUrl
		)
	} catch (error) {
		reportServerError(error, { request, properties: { sceneId, projectId } })
		return null
	}
}
