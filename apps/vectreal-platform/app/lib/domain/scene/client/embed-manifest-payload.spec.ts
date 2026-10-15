import { describe, expect, it } from 'vitest'

import {
	embedManifestToScenePayload,
	sceneSourceFromManifest
} from './embed-manifest-payload'

import type { SceneEmbedManifestResponse } from '../../../../types/api'
import type { ModelSource } from '@vctrl/hooks/use-load-model'

const serverSource: ModelSource = {
	kind: 'server',
	sceneId: 'scene-1',
	serverOptions: { endpoint: '/api/scenes/scene-1?projectId=p&preview=1' },
	parseMode: 'direct'
}

const manifest: SceneEmbedManifestResponse = {
	sceneId: 'scene-1',
	meta: null,
	publishedModel: {
		url: '/api/scenes/scene-1/assets/glb-1?sig=x',
		fileName: 'scene.glb',
		mimeType: 'model/gltf-binary',
		byteSize: 10
	},
	settings: null,
	assetRefs: {},
	settingsUpdatedAt: null
}

describe('sceneSourceFromManifest', () => {
	it('loads a published scene from the manifest the document carried', () => {
		expect(sceneSourceFromManifest('scene-1', manifest, serverSource)).toEqual({
			kind: 'scene-data',
			sceneId: 'scene-1',
			sceneData: embedManifestToScenePayload(manifest),
			parseMode: 'direct'
		})
	})

	it('loads a draft, which carries no manifest, from the server', () => {
		expect(sceneSourceFromManifest('scene-1', null, serverSource)).toBe(
			serverSource
		)
	})
})
