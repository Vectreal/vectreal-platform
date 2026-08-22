import { PERSISTED_BAKE_FILENAME, SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'
import { describe, expect, it } from 'vitest'

import {
	buildEmbedAssetRefs,
	buildPublishedModelRef,
	isEmbedServableAssetId,
	selectEmbedServableAssets,
	type EmbedAssetRow
} from '../app/lib/domain/scene/embed-asset-policy'

/**
 * The production shape that broke embeds: `scene_published.asset_id` is written
 * by `uploadPublishedGlb`, which never links into `scene_assets`, so the
 * published GLB is deliberately absent from the rows below.
 */
const PUBLISHED_ASSET_ID = 'published-glb-id'
const BAKE_ASSET_ID = 'bake-id'

const SCENE_ASSETS: EmbedAssetRow[] = [
	{
		id: 'buffer-id',
		name: 'buffer.bin',
		mimeType: 'application/octet-stream',
		fileSize: 2902308
	},
	{
		id: 'basecolor-id',
		name: 'Shoe_baseColor.webp',
		mimeType: 'image/webp',
		fileSize: 84996
	},
	{
		id: 'normal-id',
		name: 'Shoe_normal.webp',
		mimeType: 'image/webp',
		fileSize: 126712
	},
	{
		id: BAKE_ASSET_ID,
		name: PERSISTED_BAKE_FILENAME,
		mimeType: 'image/png',
		fileSize: 27530
	},
	{
		id: 'thumbnail-id',
		name: SCENE_THUMBNAIL_FILENAME,
		mimeType: 'image/webp',
		fileSize: 4096
	},
	{
		id: 'gltf-id',
		name: 'scene.gltf',
		mimeType: 'model/gltf+json',
		fileSize: 15000
	}
]

const buildAssetUrl = (assetId: string) => `/api/assets/${assetId}`

function servableWithBake() {
	return selectEmbedServableAssets({
		publishedAssetId: PUBLISHED_ASSET_ID,
		sceneAssets: SCENE_ASSETS,
		bakedShadowAssetId: BAKE_ASSET_ID
	})
}

describe('embed asset policy', () => {
	/**
	 * The invariant the two halves of the embed path violated. Asserting it as
	 * one property is the whole point: testing the manifest and the gate
	 * separately is exactly what let them end up disjoint while each looked
	 * correct on its own.
	 */
	it('serves every asset the embed manifest references, and nothing else', () => {
		const servable = servableWithBake()
		const refs = buildEmbedAssetRefs(servable, SCENE_ASSETS, buildAssetUrl)
		const publishedModel = buildPublishedModelRef(
			{
				assetId: PUBLISHED_ASSET_ID,
				fileName: 'shoe.glb',
				mimeType: 'model/gltf-binary',
				byteSize: 812345
			},
			buildAssetUrl
		)

		const referenced = [...Object.keys(refs), PUBLISHED_ASSET_ID]

		for (const assetId of referenced) {
			expect(
				isEmbedServableAssetId(assetId, servable),
				`manifest references ${assetId} but the gate would refuse it`
			).toBe(true)
		}

		expect(publishedModel.url).toBe(buildAssetUrl(PUBLISHED_ASSET_ID))
	})

	it('refuses every editor asset the manifest does not reference', () => {
		const servable = servableWithBake()
		const refused = SCENE_ASSETS.filter(
			(asset) => asset.id !== BAKE_ASSET_ID
		).map((asset) => asset.id)

		for (const assetId of refused) {
			expect(
				isEmbedServableAssetId(assetId, servable),
				`${assetId} is an editor asset and must not be servable`
			).toBe(false)
		}
	})

	it('references only the bake, never the source buffers or textures', () => {
		const refs = buildEmbedAssetRefs(
			servableWithBake(),
			SCENE_ASSETS,
			buildAssetUrl
		)

		expect(Object.keys(refs)).toEqual([BAKE_ASSET_ID])
		expect(refs[BAKE_ASSET_ID]).toEqual({
			url: buildAssetUrl(BAKE_ASSET_ID),
			fileName: PERSISTED_BAKE_FILENAME,
			mimeType: 'image/png',
			byteSize: 27530
		})
	})

	describe('bake resolution requires intent and authorization to agree', () => {
		it('resolves when the declared id is a linked row with the bake filename', () => {
			expect(servableWithBake().bakeAssetId).toBe(BAKE_ASSET_ID)
		})

		it('refuses a declared id that is not linked to the scene', () => {
			const servable = selectEmbedServableAssets({
				publishedAssetId: PUBLISHED_ASSET_ID,
				sceneAssets: SCENE_ASSETS,
				bakedShadowAssetId: 'some-other-scenes-bake'
			})

			expect(servable.bakeAssetId).toBeNull()
			expect(isEmbedServableAssetId('some-other-scenes-bake', servable)).toBe(
				false
			)
		})

		/**
		 * Settings are user-writable through the save path, so a crafted save must
		 * not be able to nominate an arbitrary linked asset as "the bake" and have
		 * it served to anonymous embed traffic.
		 */
		it('refuses a declared id that is linked but is not the bake', () => {
			const servable = selectEmbedServableAssets({
				publishedAssetId: PUBLISHED_ASSET_ID,
				sceneAssets: SCENE_ASSETS,
				bakedShadowAssetId: 'basecolor-id'
			})

			expect(servable.bakeAssetId).toBeNull()
			expect(isEmbedServableAssetId('basecolor-id', servable)).toBe(false)
		})

		it('yields no refs when the scene has no bake', () => {
			const servable = selectEmbedServableAssets({
				publishedAssetId: PUBLISHED_ASSET_ID,
				sceneAssets: SCENE_ASSETS,
				bakedShadowAssetId: null
			})

			expect(servable.bakeAssetId).toBeNull()
			expect(buildEmbedAssetRefs(servable, SCENE_ASSETS, buildAssetUrl)).toEqual(
				{}
			)
		})
	})

	describe('published model ref', () => {
		it('keeps a stored .glb filename', () => {
			const ref = buildPublishedModelRef(
				{
					assetId: PUBLISHED_ASSET_ID,
					fileName: 'blue-vans-shoe.glb',
					mimeType: 'model/gltf-binary',
					byteSize: 500
				},
				buildAssetUrl
			)

			expect(ref.fileName).toBe('blue-vans-shoe.glb')
			expect(ref.mimeType).toBe('model/gltf-binary')
			expect(ref.byteSize).toBe(500)
		})

		/**
		 * The client hands this filename to `ModelLoader.getFileType`, which throws
		 * on an extension it does not recognize. A stored name is data, and a
		 * crash there would take down the whole embed.
		 */
		it('falls back to a .glb name when the stored one is unusable', () => {
			for (const fileName of [null, '', '   ', 'scene', 'scene.gltf']) {
				expect(
					buildPublishedModelRef(
						{
							assetId: PUBLISHED_ASSET_ID,
							fileName,
							mimeType: null,
							byteSize: null
						},
						buildAssetUrl
					).fileName
				).toBe('scene.glb')
			}
		})

		it('defaults a missing mime type to the GLB type', () => {
			expect(
				buildPublishedModelRef(
					{
						assetId: PUBLISHED_ASSET_ID,
						fileName: 'scene.glb',
						mimeType: null,
						byteSize: null
					},
					buildAssetUrl
				).mimeType
			).toBe('model/gltf-binary')
		})
	})
})
