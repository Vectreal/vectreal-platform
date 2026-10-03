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
})
