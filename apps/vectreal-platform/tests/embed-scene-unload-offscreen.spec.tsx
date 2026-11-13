// @vitest-environment jsdom
/**
 * The published viewer frees its canvas off-screen unless the author kept the
 * scene loaded. The viewer is stubbed as in
 * `embed-scene-interaction-hint.spec.tsx`.
 */
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SceneEmbedPage from '../app/components/scene-embed/scene-embed-page'

import type { ServerSceneData } from '@vctrl/hooks/use-load-model'
import type { VectrealViewerProps } from '@vctrl/viewer'

const captured: VectrealViewerProps[] = []
const scene = { current: {} as ServerSceneData }

vi.mock('../app/components/viewer/client-vectreal-viewer', () => ({
	ClientVectrealViewer: (props: VectrealViewerProps) => {
		captured.push(props)
		return null
	}
}))

vi.mock('../app/components/scene-embed/use-scene-embed-scene', () => ({
	useSceneEmbedScene: () => ({
		file: { model: {} },
		sceneData: scene.current,
		loadError: null,
		retrySceneLoad: () => Promise.resolve()
	})
}))

vi.mock('../app/lib/domain/embed/hosted-preview-bridge', () => ({
	useHostedPreviewBridge: () => ({})
}))

vi.mock('react-router', () => ({
	useLocation: () => ({ pathname: '/embed/project/scene' }),
	useSearchParams: () => [new URLSearchParams(), () => undefined]
}))

function renderEmbed(sceneData: ServerSceneData) {
	scene.current = sceneData
	render(<SceneEmbedPage projectId="p" sceneId="s" />)
	const props = captured.at(-1)
	if (!props) throw new Error('the viewer was never rendered')
	return props
}

beforeEach(() => {
	captured.length = 0
})

describe('the published viewer off-screen', () => {
	it('unloads for a scene that says nothing', () => {
		expect(renderEmbed({} as ServerSceneData).unloadWhenOffscreen).toBe(true)
	})

	it('stays loaded where the author kept it', () => {
		expect(
			renderEmbed({
				presentation: { unloadWhenOffscreen: false }
			} as ServerSceneData).unloadWhenOffscreen
		).toBe(false)
	})
})
