// @vitest-environment jsdom
/**
 * An embed mounts its viewer while the scene is still loading.
 *
 * The page used to show a plain spinner until the model had downloaded and
 * parsed, which kept the viewer's code, its WebGL context and the environment
 * map from loading until then too: each waited on the model in turn. Mounted
 * from the start, they load alongside it, and the viewer's own loader covers
 * the wait.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import SceneEmbedPage from '../app/components/scene-embed/scene-embed-page'

import type { VectrealViewerProps } from '@vctrl/viewer'
import type { ReactElement } from 'react'

const captured: VectrealViewerProps[] = []

vi.mock('../app/components/viewer/client-vectreal-viewer', () => ({
	ClientVectrealViewer: (props: VectrealViewerProps) => {
		captured.push(props)
		return props.loader as ReactElement
	}
}))

vi.mock('../app/lib/domain/embed/hosted-preview-bridge', () => ({
	useHostedPreviewBridge: () => ({})
}))

vi.mock('react-router', () => ({
	useSearchParams: () => [new URLSearchParams(), () => undefined]
}))

const loadState = { current: { file: null as null | { model: object } } }

vi.mock('../app/components/scene-embed/use-scene-embed-scene', () => ({
	useSceneEmbedScene: () => ({
		file: loadState.current.file,
		sceneData: undefined,
		loadError: null,
		retrySceneLoad: () => Promise.resolve()
	})
}))

describe('an embed that is still loading its scene', () => {
	it('mounts the viewer before the model has arrived', () => {
		captured.length = 0
		loadState.current = { file: null }
		render(<SceneEmbedPage projectId="p" sceneId="s" />)

		const viewer = captured.at(-1)
		if (!viewer) throw new Error('the viewer was not mounted while loading')
		expect(viewer.model).toBeUndefined()
		expect(screen.getByText('Loading scene...')).toBeTruthy()
	})

	it('says it is preparing the scene once the model is in', () => {
		loadState.current = { file: { model: {} } }
		render(<SceneEmbedPage projectId="p" sceneId="s" />)

		expect(screen.getByText('Preparing scene...')).toBeTruthy()
	})

	it('hands the viewer the manifest’s environment before the model arrives', () => {
		captured.length = 0
		loadState.current = { file: null }
		const manifest = {
			sceneId: 's',
			meta: null,
			publishedModel: {
				url: '/m.glb',
				fileName: 'm.glb',
				mimeType: 'model/gltf-binary',
				byteSize: 1
			},
			assetRefs: {},
			settings: { environment: { preset: 'studio-soft' as const } },
			settingsUpdatedAt: null
		}
		render(
			<SceneEmbedPage projectId="p" sceneId="s" initialManifest={manifest} />
		)
		expect(captured.at(-1)?.envOptions).toEqual({ preset: 'studio-soft' })

		render(
			<SceneEmbedPage
				projectId="p"
				sceneId="s"
				initialManifest={{ ...manifest, settings: null }}
			/>
		)
		expect(captured.at(-1)?.envOptions).toEqual({})
	})

	it('shows the thumbnail the manifest serves behind the loader', () => {
		captured.length = 0
		loadState.current = { file: null }
		render(
			<SceneEmbedPage
				projectId="p"
				sceneId="s"
				initialManifest={{
					sceneId: 's',
					meta: null,
					publishedModel: {
						url: '/m.glb',
						fileName: 'm.glb',
						mimeType: 'model/gltf-binary',
						byteSize: 1
					},
					assetRefs: {
						'thumb-1': {
							url: '/api/scenes/s/assets/thumb-1?exp=1&sig=c',
							fileName: 'scene-thumbnail.webp',
							mimeType: 'image/webp',
							byteSize: 4
						}
					},
					settings: null,
					settingsUpdatedAt: null
				}}
			/>
		)
		expect(captured.at(-1)?.loadingThumbnail?.src).toBe(
			'/api/scenes/s/assets/thumb-1?exp=1&sig=c'
		)
	})
})
