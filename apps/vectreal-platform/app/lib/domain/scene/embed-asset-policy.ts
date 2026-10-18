import { PERSISTED_BAKE_FILENAME, SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'
import {
	DRACO_EXTENSION,
	KTX2_EXTENSION,
	MESHOPT_EXTENSION
} from '@vctrl/core/model-loader'

import {
	hotspotArtworkAssetIdFromUrl,
	isHotspotArtworkAsset
} from './hotspot-artwork'

import type {
	HotspotDefinition,
	PublishedModelRef,
	SceneAssetRefMap
} from '@vctrl/core'

/**
 * The single owner of "what may an external embed fetch?".
 *
 * This rule used to live in two places that had no reason to agree, and they
 * did not: the manifest offered every `scene_assets` row while the asset route
 * served only `scene_published.asset_id`, which `uploadPublishedGlb` never
 * links into `scene_assets`. The two sets were disjoint, so every asset an
 * embed requested 404'd and no embed could ever render.
 *
 * Both sides now call this module. It is pure - no database import and no
 * `.server` suffix - so a test can import it, which is what makes the
 * disjointness assertable. Importing a server route module in a test pulls in
 * the db client and fails with `Missing DATABASE_URL`; `scene-route-params.ts`
 * is the precedent for extracting the decision instead.
 */

/** The `scene_assets` columns this policy needs. */
export interface EmbedAssetRow {
	id: string
	name: string
	mimeType: string | null
	fileSize: number | null
}

/** The published GLB, as `getPublishedScenePreview` returns it. */
export interface PublishedModelRow {
	assetId: string
	fileName: string | null
	mimeType: string | null
	byteSize: number | null
	/** The extensions the GLB declares, recorded on upload; null if unknown. */
	extensionsUsed?: readonly string[] | null
}

/**
 * Every asset id an embed is allowed to fetch, and therefore every asset id the
 * embed manifest is allowed to reference. Deliberately a closed set: the
 * optimized GLB, the persisted shadow bake that lives outside it, the scene's
 * saved thumbnail when its author chose to show it while loading, and the
 * uploaded artwork of the markers an embed draws.
 */
export interface EmbedServableAssets {
	publishedAssetId: string
	bakeAssetId: string | null
	thumbnailAssetId: string | null
	hotspotArtworkAssetIds: readonly string[]
}

const GLB_MIME_TYPE = 'model/gltf-binary'
const FALLBACK_GLB_FILENAME = 'scene.glb'

/**
 * Resolves the bake from two independent sources and requires them to agree.
 *
 * `settings.shadows.baked.assetId` carries intent but is user-writable through
 * the save path, so it cannot authorize on its own - otherwise a crafted save
 * could name any linked asset as "the bake" and have it served to anonymous
 * embed traffic. The `scene_assets` link plus the stable filename is the
 * authorization half, and the filename alone is not an identity either, because
 * assets are deduplicated per project by content hash.
 */
export function selectEmbedServableAssets({
	sceneId,
	publishedAssetId,
	sceneAssets,
	bakedShadowAssetId,
	showsLoadingThumbnail = false,
	hotspots
}: {
	sceneId: string
	publishedAssetId: string
	sceneAssets: readonly EmbedAssetRow[]
	bakedShadowAssetId?: string | null
	/** The author's `presentation.showLoadingThumbnail`. */
	showsLoadingThumbnail?: boolean
	/** The scene's stored hotspots, before any redaction. */
	hotspots?: readonly HotspotDefinition[] | null
}): EmbedServableAssets {
	const declaredBakeId = bakedShadowAssetId?.trim() || null

	const bakeAssetId =
		declaredBakeId &&
		sceneAssets.some(
			(asset) =>
				asset.id === declaredBakeId && asset.name === PERSISTED_BAKE_FILENAME
		)
			? declaredBakeId
			: null

	// Opted into per scene, and found by the link and its stable name: the
	// thumbnail's id is not recorded anywhere a save could forge.
	const thumbnailAssetId = showsLoadingThumbnail
		? (sceneAssets.find((asset) => asset.name === SCENE_THUMBNAIL_FILENAME)
				?.id ?? null)
		: null

	return {
		publishedAssetId,
		bakeAssetId,
		thumbnailAssetId,
		hotspotArtworkAssetIds: selectHotspotArtwork(sceneId, sceneAssets, hotspots)
	}
}

/**
 * The uploaded artwork an embed draws, and therefore may fetch.
 *
 * The bake's two-source rule again, because a marker's `payloadUrl` is just as
 * user-writable through the save path: on its own it could name any asset the
 * scene links - an original texture, the kept source model - and have it
 * served to anonymous embed traffic. So the declared id has to be linked to
 * the scene AND be a row stored as artwork.
 *
 * Only markers the embed actually draws declare anything. An internal marker
 * is dropped from the embed and a hidden one loses its artwork
 * (`redactSettingsForEmbed`), and a dot never renders an image, so none of
 * them may unlock a fetch either.
 */
function selectHotspotArtwork(
	sceneId: string,
	sceneAssets: readonly EmbedAssetRow[],
	hotspots: readonly HotspotDefinition[] | null | undefined
): string[] {
	const declared = new Set(
		(hotspots ?? [])
			.filter(
				(hotspot) =>
					!hotspot.internalOnly &&
					hotspot.visible !== false &&
					hotspot.stylePreset !== 'dot'
			)
			.map((hotspot) =>
				hotspotArtworkAssetIdFromUrl(sceneId, hotspot.payloadUrl)
			)
			.filter((assetId): assetId is string => assetId !== null)
	)

	return sceneAssets
		.filter((asset) => declared.has(asset.id) && isHotspotArtworkAsset(asset))
		.map((asset) => asset.id)
}

export function isEmbedServableAssetId(
	assetId: string,
	servable: EmbedServableAssets
): boolean {
	return (
		assetId === servable.publishedAssetId ||
		(servable.bakeAssetId !== null && assetId === servable.bakeAssetId) ||
		(servable.thumbnailAssetId !== null &&
			assetId === servable.thumbnailAssetId) ||
		servable.hotspotArtworkAssetIds.includes(assetId)
	)
}

/**
 * The manifest's `assetRefs` for an embed: the bake and the loading thumbnail,
 * when servable, and nothing else. The published GLB is referenced separately
 * as `publishedModel`, because the loader treats it as the model rather than
 * as a side asset.
 */
export function buildEmbedAssetRefs(
	servable: EmbedServableAssets,
	sceneAssets: readonly EmbedAssetRow[],
	buildAssetUrl: (assetId: string) => string
): SceneAssetRefMap {
	const refs: SceneAssetRefMap = {}

	for (const assetId of [servable.bakeAssetId, servable.thumbnailAssetId]) {
		const asset = assetId
			? sceneAssets.find((candidate) => candidate.id === assetId)
			: undefined
		if (!asset) continue
		refs[asset.id] = {
			url: buildAssetUrl(asset.id),
			fileName: asset.name,
			mimeType: asset.mimeType ?? 'application/octet-stream',
			byteSize: asset.fileSize ?? null
		}
	}

	return refs
}

/**
 * The extensions a published GLB declared, as `uploadPublishedGlb` recorded
 * them in the asset row's metadata. Null for a GLB uploaded before that, or
 * metadata in any other shape: an unknown answer, never a guessed one.
 */
export function extensionsUsedFromMetadata(metadata: unknown): string[] | null {
	const recorded = (metadata as { gltfExtensionsUsed?: unknown } | null)
		?.gltfExtensionsUsed
	return Array.isArray(recorded) &&
		recorded.every((name) => typeof name === 'string')
		? recorded
		: null
}

/**
 * The filename is forced to end in `.glb` because the client hands it to
 * `ModelLoader`, whose `formatFor` throws on an extension it does not
 * recognize. Publishing has always written `<base>.glb`, but a stored name is
 * data and a crash here would take the whole embed down.
 */
export function buildPublishedModelRef(
	published: PublishedModelRow,
	buildAssetUrl: (assetId: string) => string
): PublishedModelRef {
	const storedName = published.fileName?.trim()
	const fileName =
		storedName && storedName.toLowerCase().endsWith('.glb')
			? storedName
			: FALLBACK_GLB_FILENAME

	return {
		url: buildAssetUrl(published.assetId),
		fileName,
		mimeType: published.mimeType ?? GLB_MIME_TYPE,
		byteSize: published.byteSize ?? null,
		...(published.extensionsUsed
			? {
					usesDraco: published.extensionsUsed.includes(DRACO_EXTENSION),
					usesMeshopt: published.extensionsUsed.includes(MESHOPT_EXTENSION),
					usesKtx2: published.extensionsUsed.includes(KTX2_EXTENSION)
				}
			: {})
	}
}
