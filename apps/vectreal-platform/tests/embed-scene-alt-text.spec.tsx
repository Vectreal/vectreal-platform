// @vitest-environment jsdom
/**
 * The viewer on every published surface is named from the author's alt text,
 * or from the scene's name and description where there is none.
 * `resolveSceneAltText` has its own unit spec; this proves the surface reads
 * it, with the viewer stubbed as in `embed-scene-view-return.spec.tsx`.
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

describe('the published viewer is named for the scene', () => {
	it("by the author's alt text", () => {
		expect(
			renderEmbed({
				meta: { name: 'Chair' },
				presentation: { altText: 'A walnut lounge chair' }
			} as ServerSceneData).label
		).toBe('A walnut lounge chair')
	})

	it("by the scene's name and description without one", () => {
		expect(
			renderEmbed({
				meta: { name: 'Chair', description: 'Our bestseller' }
			} as ServerSceneData).label
		).toBe('Chair. Our bestseller')
	})
})
