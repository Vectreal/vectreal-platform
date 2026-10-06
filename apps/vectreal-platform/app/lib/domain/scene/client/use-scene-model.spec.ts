import { describe, expect, it } from 'vitest'

import { sceneSourceKey } from './use-scene-model'

import type { ModelSource } from '@vctrl/hooks/use-load-model'

const published = (url: string): ModelSource => ({
	kind: 'scene-data',
	sceneId: 'scene-1',
	parseMode: 'direct',
	sceneData: {
		settings: null,
		gltfJson: null,
		assetData: null,
		publishedModel: {
			url,
			fileName: 'scene.glb',
			mimeType: 'model/gltf-binary',
			byteSize: 1
		}
	}
})

describe('sceneSourceKey', () => {
	it('stays put when only the signature on the same GLB moved', () => {
		expect(
			sceneSourceKey(published('/api/scenes/scene-1/assets/glb-1?exp=1&sig=a'))
		).toBe(
			sceneSourceKey(published('/api/scenes/scene-1/assets/glb-1?exp=2&sig=b'))
		)
	})

	it('moves when the scene was republished as a different GLB', () => {
		expect(
			sceneSourceKey(published('/api/scenes/scene-1/assets/glb-1?sig=a'))
		).not.toBe(
			sceneSourceKey(published('/api/scenes/scene-1/assets/glb-2?sig=a'))
		)
	})
})
