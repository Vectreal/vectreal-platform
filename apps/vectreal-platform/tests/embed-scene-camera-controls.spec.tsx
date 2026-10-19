// @vitest-environment jsdom
/**
 * `?cameraControls=0` reaches the viewer.
 *
 * `resolveEmbedCameraControls` has its own unit spec, and passing it proves
 * nothing about this: a host that switches cameras itself is left with two
 * competing controls if the page reads the parameter and never passes it on.
 * So the viewer is stubbed at the bottom of the chain and the page goes in at
 * the top, as in `embed-scene-theme.spec.tsx`.
 */
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SceneEmbedPage from '../app/components/scene-embed/scene-embed-page'

import type { ServerSceneData } from '@vctrl/hooks/use-load-model'
import type { VectrealViewerProps } from '@vctrl/viewer'

const captured: VectrealViewerProps[] = []

vi.mock('../app/components/viewer/client-vectreal-viewer', () => ({
	ClientVectrealViewer: (props: VectrealViewerProps) => {
		captured.push(props)
		return null
	}
}))

vi.mock('../app/components/scene-embed/use-scene-embed-scene', () => ({
	useSceneEmbedScene: () => ({
		file: { model: {} },
		sceneData: {} as ServerSceneData,
		loadError: null,
		retrySceneLoad: () => Promise.resolve()
	})
}))

vi.mock('../app/lib/domain/embed/hosted-preview-bridge', () => ({
	useHostedPreviewBridge: () => ({})
}))

const searchParams = { current: new URLSearchParams() }

vi.mock('react-router', () => ({
	useLocation: () => ({ pathname: '/embed/project/scene' }),
	useSearchParams: () => [searchParams.current, () => undefined]
}))

function renderEmbed(query = '') {
	captured.length = 0
	searchParams.current = new URLSearchParams(query)
	render(<SceneEmbedPage projectId="p" sceneId="s" />)
	const props = captured.at(-1)
	if (!props) throw new Error('the viewer was never rendered')
	return props
}

beforeEach(() => {
	captured.length = 0
})

describe('an embed host can take over switching cameras', () => {
	it('leaves the switcher to the viewer when the host says nothing', () => {
		expect(renderEmbed().showCameraControls).toBe(true)
	})

	it('turns it off with ?cameraControls=0', () => {
		expect(renderEmbed('cameraControls=0').showCameraControls).toBe(false)
	})
})
