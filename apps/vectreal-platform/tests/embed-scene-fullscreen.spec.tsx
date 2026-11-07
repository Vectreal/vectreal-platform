// @vitest-environment jsdom
/**
 * The published viewer draws a full screen button only where the author
 * switched it on. `shouldShowFullscreenButton` has its own unit spec; this
 * proves the surface reads it, as `embed-scene-alt-text.spec.tsx` does.
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

describe('the published viewer draws a full screen button', () => {
	it('not for a scene that says nothing', () => {
		expect(renderEmbed({} as ServerSceneData).showFullscreenButton).toBe(false)
	})

	it('where the author switched it on', () => {
		expect(
			renderEmbed({
				presentation: { showFullscreenButton: true }
			} as ServerSceneData).showFullscreenButton
		).toBe(true)
	})
})
