import { SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'

import { shouldShowLoadingThumbnail } from '../scene-presentation'
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
	SceneManifestResponse,
	SceneSourceRef
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

/** The kept original as a fetchable ref, kept out of the model's refs. */
export function toSourceRef(
	asset: SceneAssetRecord | null,
	buildAssetUrl: (assetId: string) => string
): SceneSourceRef | null {
	if (!asset) return null
	return {
		assetId: asset.id,
		url: buildAssetUrl(asset.id),
		fileName: asset.name,
		mimeType: asset.mimeType ?? 'application/octet-stream',
		byteSize: asset.fileSize ?? null
	}
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
			settingsUpdatedAt: null,
			source: null
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
			: null,
		source: toSourceRef(settingsData.sourceAsset, buildAssetUrl)
	}
}

/**
 * The manifest of a published scene: what an embed receives, and what
 * `/preview` and the dashboard show of it.
 *
 * Deliberately a different function rather than a flag on
 * {@link buildSceneManifest}: a draft's preview and the publisher keep the
 * editor manifest untouched by construction, and the two shapes cannot drift
 * into each other by someone reading the flag the wrong way round.
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
	return composeEmbedSceneManifest(
		sceneId,
		published,
		await readEmbedSceneSettings(sceneId),
		buildAssetUrl
	)
}

/**
 * The settings half of an embed manifest, which depends on nothing but the
 * scene id. Split out so the `/embed` document can read it alongside the
 * publication instead of after it.
 *
 * A failed read throws rather than reading as "no settings": a manifest built
 * from that would render the published model with default lighting and no
 * shadow, where a failure lets the caller fall back or report it.
 */
export function readEmbedSceneSettings(sceneId: string) {
	return sceneSettingsService.getSceneSettingsWithAssetRefs(sceneId, {
		includeGltfJson: false,
		readErrors: 'throw'
	})
}

export type EmbedSceneSettings = Awaited<
	ReturnType<typeof readEmbedSceneSettings>
>

/**
 * Assembles an embed manifest from settings already read. Whatever the caller
 * read them for, only the published scene's own are ever passed here.
 */
export async function composeEmbedSceneManifest(
	sceneId: string,
	published: PublishedModelRow,
	settingsData: EmbedSceneSettings,
	buildAssetUrl: (assetId: string) => string
): Promise<SceneEmbedManifestResponse> {
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
		bakedShadowAssetId: settings?.shadows?.baked?.assetId,
		showsLoadingThumbnail: shouldShowLoadingThumbnail(settings?.presentation)
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
