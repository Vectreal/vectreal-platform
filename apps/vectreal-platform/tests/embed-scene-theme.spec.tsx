// @vitest-environment jsdom
/**
 * The color scheme an embedded scene renders in, asserted across the whole
 * path rather than at either end of it.
 *
 * `parseEmbedViewerTheme` has its own unit spec, and passing it proves
 * nothing on its own: the defect being fixed here was never a wrong rule, it
 * was a correct default that no surface reached. `ClientVectrealViewer`
 * defaults to `dark`, `SceneEmbedViewer` passed no theme at all, and so every
 * embed rendered dark chrome on every host. So the stub sits at the bottom of
 * the chain and the page goes in at the top.
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
		isLoadingScene: false,
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
	useSearchParams: () => [searchParams.current, () => undefined]
}))

function renderEmbed(query = '', theme?: 'light' | 'dark' | 'system') {
	captured.length = 0
	searchParams.current = new URLSearchParams(query)
	render(<SceneEmbedPage projectId="p" sceneId="s" theme={theme} />)
	const props = captured.at(-1)
	if (!props) throw new Error('the viewer was never rendered')
	return props
}

beforeEach(() => {
	captured.length = 0
})

describe('an embedded scene follows the host it is sitting in', () => {
	it('follows the visitor’s own scheme when the host says nothing', () => {
		expect(renderEmbed().theme).toBe('system')
	})

	it('takes an explicit scheme from the embed URL', () => {
		// For a host that forces a scheme against the visitor's OS setting,
		// which `prefers-color-scheme` inside the iframe cannot see.
		expect(renderEmbed('theme=light').theme).toBe('light')
		expect(renderEmbed('theme=dark').theme).toBe('dark')
	})

	it('falls back rather than blanking the scene on a bad parameter', () => {
		expect(renderEmbed('theme=drak').theme).toBe('system')
	})

	it('lets a surface that owns its background overrule the URL', () => {
		// `/preview` draws `PreviewChrome` over the viewer in app tokens, so it
		// passes the app's scheme. Without this the two disagree for anyone whose
		// app theme is not their OS setting: light chrome over a dark viewer.
		expect(renderEmbed('theme=dark', 'light').theme).toBe('light')
	})
})
