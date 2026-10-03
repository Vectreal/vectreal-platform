import { DRACO_DECODER_PATH, resolveEnvironmentFiles } from '@vctrl/core'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { describe, expect, it } from 'vitest'

import { resolveEmbedResourceHints } from './embed-resource-hints'

import type { SceneEmbedManifestResponse } from '../../../types/api'

const manifest = (
	overrides: Partial<SceneEmbedManifestResponse> = {}
): SceneEmbedManifestResponse => ({
	sceneId: 's1',
	meta: null,
	publishedModel: {
		url: '/api/scenes/s1/assets/glb-1?exp=1&sig=a',
		fileName: 'shoe.glb',
		mimeType: 'model/gltf-binary',
		byteSize: 10
	},
	assetRefs: {},
	settings: { environment: { preset: 'studio-soft' } },
	settingsUpdatedAt: null,
	...overrides
})

const hrefs = (m: SceneEmbedManifestResponse) =>
	resolveEmbedResourceHints(m).preload.map((hint) => hint.href)

describe('resolveEmbedResourceHints', () => {
	it('preloads the model first, as the request the loader makes', () => {
		const [first] = resolveEmbedResourceHints(manifest()).preload
		expect(first).toEqual({
			href: '/api/scenes/s1/assets/glb-1?exp=1&sig=a',
			as: 'fetch',
			fetchPriority: 'high',
			crossOrigin: 'anonymous'
		})
	})

	it('preloads the environment map the viewer will load, and connects to its host', () => {
		const hints = resolveEmbedResourceHints(manifest())
		const environment = resolveEnvironmentFiles({ preset: 'studio-soft' })
		expect(hints.preload.map((hint) => hint.href)).toContain(environment)
		expect(hints.preconnect).toEqual(['https://storage.googleapis.com'])
	})

	it('preloads the default environment for a scene that names none', () => {
		expect(hrefs(manifest({ settings: null }))).toContain(
			resolveEnvironmentFiles()
		)
	})

	it('preloads the Draco decoder only for a model known to need it', () => {
		// What three's loader will actually request from the path ModelLoader
		// gives it; `decoderPaths` is public at runtime but untyped.
		const decoder = (
			new DRACOLoader().setDecoderPath(DRACO_DECODER_PATH) as unknown as {
				decoderPaths: { js: string; wasm: string }
			}
		).decoderPaths
		const draco = manifest({
			publishedModel: { ...manifest().publishedModel, usesDraco: true }
		})

		expect(hrefs(draco)).toEqual(
			expect.arrayContaining([decoder.js, decoder.wasm])
		)
		expect(hrefs(manifest())).not.toContain(decoder.wasm)
		expect(
			hrefs(
				manifest({
					publishedModel: { ...manifest().publishedModel, usesDraco: false }
				})
			)
		).not.toContain(decoder.wasm)
	})

	it('preloads the shadow bake as the image the viewer will load', () => {
		const bake = manifest({
			assetRefs: {
				'bake-1': {
					url: '/api/scenes/s1/assets/bake-1?exp=1&sig=b',
					fileName: 'shadow-bake.png',
					mimeType: 'image/png',
					byteSize: 4
				}
			}
		})
		expect(resolveEmbedResourceHints(bake).preload).toContainEqual({
			href: '/api/scenes/s1/assets/bake-1?exp=1&sig=b',
			as: 'image',
			fetchPriority: 'low',
			crossOrigin: 'anonymous'
		})
	})

	it('preloads the loading thumbnail first-class, as the plain image it is', () => {
		const withThumbnail = manifest({
			assetRefs: {
				'thumb-1': {
					url: '/api/scenes/s1/assets/thumb-1?exp=1&sig=c',
					fileName: 'scene-thumbnail.webp',
					mimeType: 'image/webp',
					byteSize: 4
				}
			}
		})
		expect(resolveEmbedResourceHints(withThumbnail).preload).toContainEqual({
			href: '/api/scenes/s1/assets/thumb-1?exp=1&sig=c',
			as: 'image',
			fetchPriority: 'high',
			crossOrigin: null
		})
	})
})
