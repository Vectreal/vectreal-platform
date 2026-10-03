// @vitest-environment jsdom
/**
 * Where an embed loads its scene from: the manifest the document carried, or
 * the manifest endpoint when the document carried none.
 */
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useSceneEmbedScene } from '../app/components/scene-embed/use-scene-embed-scene'

import type { SceneEmbedManifestResponse } from '../app/types/api'
import type { ModelSource } from '@vctrl/hooks/use-load-model'

const sources: Array<ModelSource | null> = []

vi.mock('../app/lib/domain/scene/client/use-scene-model', () => ({
	useSceneModel: (_model: unknown, source: ModelSource | null) => {
		sources.push(source)
	}
}))

vi.mock('@vctrl/hooks/use-load-model', () => ({
	useLoadModel: () => ({
		file: null,
		sceneData: null,
		error: null,
		load: vi.fn()
	})
}))

vi.mock('@posthog/react', () => ({ usePostHog: () => null }))

vi.mock('../app/components/consent/consent-context', () => ({
	useConsent: () => ({ consent: null })
}))

vi.mock('react-router', () => ({
	useSearchParams: () => [new URLSearchParams('token=vctrl_live')]
}))

const manifest = {
	sceneId: 's1',
	meta: { name: 'Shoe', description: '', thumbnailUrl: '' },
	publishedModel: {
		url: '/api/scenes/s1/assets/glb-1?exp=1&sig=a',
		fileName: 'shoe.glb',
		mimeType: 'model/gltf-binary',
		byteSize: 10
	},
	assetRefs: {},
	settings: null,
	settingsUpdatedAt: null
} satisfies SceneEmbedManifestResponse

describe('useSceneEmbedScene', () => {
	it('loads the manifest the document carried, without asking for it', () => {
		sources.length = 0
		renderHook(() =>
			useSceneEmbedScene({
				sceneId: 's1',
				projectId: 'p1',
				initialManifest: manifest
			})
		)

		const source = sources.at(-1)
		expect(source).toMatchObject({
			kind: 'scene-data',
			sceneId: 's1',
			sceneData: { publishedModel: manifest.publishedModel, gltfJson: null }
		})
	})

	it('asks the manifest endpoint when the document carried none', () => {
		sources.length = 0
		renderHook(() =>
			useSceneEmbedScene({
				sceneId: 's1',
				projectId: 'p1',
				initialManifest: null
			})
		)

		expect(sources.at(-1)).toMatchObject({ kind: 'server', sceneId: 's1' })
	})
})
