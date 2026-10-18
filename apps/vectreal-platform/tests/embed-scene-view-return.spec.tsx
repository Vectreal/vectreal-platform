// @vitest-environment jsdom
/**
 * The author's `presentation.showSceneViewReturn` reaches the viewer.
 *
 * `shouldShowSceneViewReturn` has its own unit spec, which proves nothing
 * about whether a published surface reads it. The viewer is stubbed at the
 * bottom of the chain and the page goes in at the top, as in
 * `embed-scene-camera-controls.spec.tsx`.
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

describe("an author can hide the way back from a hotspot's camera", () => {
	it('keeps it for a scene that says nothing', () => {
		expect(renderEmbed({} as ServerSceneData).showSceneViewReturn).toBe(true)
	})

	it('hides it where the author switched it off', () => {
		expect(
			renderEmbed({
				presentation: { showSceneViewReturn: false }
			} as ServerSceneData).showSceneViewReturn
		).toBe(false)
	})
})
