import { PERSISTED_BAKE_FILENAME } from '@vctrl/core'

import type { SceneAssetRef, SceneAssetRefMap } from '@vctrl/core'

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
}

/**
 * Every asset id an embed is allowed to fetch, and therefore every asset id the
 * embed manifest is allowed to reference. Deliberately a closed set of two:
 * the optimized GLB, and the persisted shadow bake that lives outside it.
 */
export interface EmbedServableAssets {
	publishedAssetId: string
	bakeAssetId: string | null
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
	publishedAssetId,
	sceneAssets,
	bakedShadowAssetId
}: {
	publishedAssetId: string
	sceneAssets: readonly EmbedAssetRow[]
	bakedShadowAssetId?: string | null
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

	return { publishedAssetId, bakeAssetId }
}

export function isEmbedServableAssetId(
	assetId: string,
	servable: EmbedServableAssets
): boolean {
	return (
		assetId === servable.publishedAssetId ||
		(servable.bakeAssetId !== null && assetId === servable.bakeAssetId)
	)
}

/**
 * The manifest's `assetRefs` for an embed: the bake and nothing else. The
 * published GLB is referenced separately as `publishedModel`, because the
 * loader treats it as the model rather than as a side asset.
 */
export function buildEmbedAssetRefs(
	servable: EmbedServableAssets,
	sceneAssets: readonly EmbedAssetRow[],
	buildAssetUrl: (assetId: string) => string
): SceneAssetRefMap {
	if (servable.bakeAssetId === null) {
		return {}
	}

	const bakeAsset = sceneAssets.find(
		(asset) => asset.id === servable.bakeAssetId
	)
	if (!bakeAsset) {
		return {}
	}

	return {
		[bakeAsset.id]: {
			url: buildAssetUrl(bakeAsset.id),
			fileName: bakeAsset.name,
			mimeType: bakeAsset.mimeType ?? 'application/octet-stream',
			byteSize: bakeAsset.fileSize ?? null
		}
	}
}

/**
 * The filename is forced to end in `.glb` because the client hands it to
 * `ModelLoader.getFileType`, which throws on an extension it does not
 * recognize. Publishing has always written `<base>.glb`, but a stored name is
 * data and a crash here would take the whole embed down.
 */
export function buildPublishedModelRef(
	published: PublishedModelRow,
	buildAssetUrl: (assetId: string) => string
): SceneAssetRef {
	const storedName = published.fileName?.trim()
	const fileName =
		storedName && storedName.toLowerCase().endsWith('.glb')
			? storedName
			: FALLBACK_GLB_FILENAME

	return {
		url: buildAssetUrl(published.assetId),
		fileName,
		mimeType: published.mimeType ?? GLB_MIME_TYPE,
		byteSize: published.byteSize ?? null
	}
}
