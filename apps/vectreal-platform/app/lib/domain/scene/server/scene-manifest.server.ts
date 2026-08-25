import { SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'

import { sceneSettingsService } from './scene-settings-service.server'
import { reportServerError } from '../../../observability/report-server-error.server'
import {
	buildEmbedAssetRefs,
	buildPublishedModelRef,
	selectEmbedServableAssets,
	type PublishedModelRow
} from '../embed-asset-policy'
import { redactSettingsForEmbed } from '../embed-settings-policy'

import type {
	SceneAssetRecord,
	SceneAssetRefMap,
	SceneEmbedManifestResponse,
	SceneManifestResponse
} from '../../../../types/api'

const GLTF_JSON_MIME_TYPE = 'model/gltf+json'

/** Maps asset rows to fetchable refs; thumbnail and glTF JSON are excluded. */
export function toAssetRefs(
	assets: SceneAssetRecord[],
	buildAssetUrl: (assetId: string) => string
): SceneAssetRefMap {
	const refs: SceneAssetRefMap = {}

	for (const asset of assets) {
		if (asset.name === SCENE_THUMBNAIL_FILENAME) continue
		if (asset.mimeType === GLTF_JSON_MIME_TYPE) continue

		refs[asset.id] = {
			url: buildAssetUrl(asset.id),
			fileName: asset.name,
			mimeType: asset.mimeType ?? 'application/octet-stream',
			byteSize: asset.fileSize ?? null
		}
	}

	return refs
}

export async function buildSceneManifest(
	sceneId: string,
	buildAssetUrl: (assetId: string) => string
): Promise<SceneManifestResponse> {
	const [sceneMetaResult, settingsResult, statsResult] =
		await Promise.allSettled([
			sceneSettingsService.getSceneMetadata(sceneId),
			sceneSettingsService.getSceneSettingsWithAssetRefs(sceneId),
			sceneSettingsService.getSceneStats(sceneId)
		])

	if (settingsResult.status === 'rejected') {
		// The manifest is still returned, one segment short, so an embed renders
		// something incomplete rather than failing visibly.
		reportServerError(settingsResult.reason, { properties: { sceneId } })
	}

	const sceneMeta =
		sceneMetaResult.status === 'fulfilled' ? sceneMetaResult.value : null
	const settingsData =
		settingsResult.status === 'fulfilled' ? settingsResult.value : null
	const stats = statsResult.status === 'fulfilled' ? statsResult.value : null

	if (!settingsData) {
		return {
			sceneId,
			meta: sceneMeta,
			stats,
			settings: null,
			gltfJson: null,
			assetRefs: null,
			assets: null,
			settingsUpdatedAt: null
		}
	}

	return {
		sceneId,
		meta: settingsData.meta ?? sceneMeta,
		stats,
		settings: settingsData.settings,
		gltfJson: settingsData.gltfJson ?? null,
		assetRefs: toAssetRefs(settingsData.assets ?? [], buildAssetUrl),
		assets: settingsData.assets ?? null,
		settingsUpdatedAt: settingsData.settingsUpdatedAt
			? settingsData.settingsUpdatedAt.toISOString()
			: null
	}
}

/**
 * The manifest an external, token-authenticated embed receives.
 *
 * Deliberately a different function rather than a flag on
 * {@link buildSceneManifest}: `/preview` and the publisher keep the editor
 * manifest untouched by construction, and the two shapes cannot drift into
 * each other by someone reading the flag the wrong way round.
 *
 * What an embed does NOT get, and why:
 * - `gltfJson` - the editor scene graph: node hierarchy, material graph, every
 *   internal name, and URIs of assets this caller may not fetch. Once
 *   `publishedModel` exists the embed has no use for it.
 * - `assets` - the raw row array leaks every editor filename and asset id.
 * - `stats` - nothing on the embed surface reads it.
 * - anything `redactSettingsForEmbed` strips: `internalOnly` hotspots, the
 *   hotspot cameras that would resurrect them, interactions targeting those
 *   cameras, and an unauthorized `shadows.baked` pointer. `SceneSettings`
 *   documents internal hotspots as excluded from the published runtime payload;
 *   `getSceneSettings` honors that behind a `forPublicView` flag no caller has
 *   ever passed, and this path never filtered at all, so they have been
 *   shipping to embeds.
 */
export async function buildEmbedSceneManifest(
	sceneId: string,
	published: PublishedModelRow,
	buildAssetUrl: (assetId: string) => string
): Promise<SceneEmbedManifestResponse> {
	const settingsData = await sceneSettingsService.getSceneSettingsWithAssetRefs(
		sceneId,
		{ includeGltfJson: false }
	)

	const publishedModel = buildPublishedModelRef(published, buildAssetUrl)

	if (!settingsData) {
		return {
			sceneId,
			meta: await sceneSettingsService.getSceneMetadata(sceneId),
			publishedModel,
			settings: null,
			assetRefs: {},
			settingsUpdatedAt: null
		}
	}

	const settings = settingsData.settings
	const servable = selectEmbedServableAssets({
		publishedAssetId: published.assetId,
		sceneAssets: settingsData.assets ?? [],
		bakedShadowAssetId: settings?.shadows?.baked?.assetId
	})

	return {
		sceneId,
		meta: settingsData.meta,
		publishedModel,
		settings: settings
			? redactSettingsForEmbed(settings, { bakeAssetId: servable.bakeAssetId })
			: null,
		assetRefs: buildEmbedAssetRefs(
			servable,
			settingsData.assets ?? [],
			buildAssetUrl
		),
		settingsUpdatedAt: settingsData.settingsUpdatedAt
			? settingsData.settingsUpdatedAt.toISOString()
			: null
	}
}

/**
 * Returns a weak ETag for the scene manifest based on the scene ID and the
 * timestamp of the last settings save. Returns null when no timestamp is
 * available so callers can skip caching headers entirely.
 *
 * `shape` keeps the embed and session manifests for one scene in separate
 * cache entries. They carry different fields from the same `settingsUpdatedAt`,
 * so a shared tag would let one be served in place of the other.
 */
export function buildSceneManifestEtag(
	sceneId: string,
	settingsUpdatedAt: string | null,
	shape: 'session' | 'embed' = 'session'
): string | null {
	if (!settingsUpdatedAt) return null
	const prefix = shape === 'embed' ? 'scene-embed' : 'scene'
	return `W/"${prefix}-${sceneId}-${settingsUpdatedAt}"`
}

