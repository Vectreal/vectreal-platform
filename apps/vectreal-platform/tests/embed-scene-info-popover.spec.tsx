// @vitest-environment jsdom
/**
 * The other half of the info-popover setting: an author switching it off has
 * to reach the surface that draws it.
 *
 * A seam test for the same reason `embed-scene-hotspots.spec.tsx` is one. The
 * rule itself is covered in `scene-presentation.spec.ts`, and a rule nothing
 * calls is exactly the shape of defect that ships: `shouldShowInfoPopover`
 * would type-check, pass its own suite, and leave every published scene
 * showing a popover its author had turned off.
 *
 * `SceneEmbedViewer` is stubbed rather than the viewer package, so nothing
 * below this component loads and what we assert is the prop this page hands
 * over.
 */
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import SceneEmbedPage from '../app/components/scene-embed/scene-embed-page'

import type { ServerSceneData } from '@vctrl/hooks/use-load-model'
import type { ComponentProps } from 'react'

type SceneEmbedViewerProps = ComponentProps<
	typeof import('../app/components/scene-embed/scene-embed-viewer').default
>

const captured: SceneEmbedViewerProps[] = []

vi.mock('../app/components/scene-embed/scene-embed-viewer', () => ({
	default: (props: SceneEmbedViewerProps) => {
		captured.push(props)
		return null
	}
}))

const sceneDataRef: { current: Partial<ServerSceneData> | undefined } = {
	current: undefined
}

vi.mock('../app/components/scene-embed/use-scene-embed-scene', () => ({
	useSceneEmbedScene: () => ({
		file: { model: {} },
		isLoadingScene: false,
		sceneData: sceneDataRef.current,
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

function renderPage(sceneData?: Partial<ServerSceneData>) {
	captured.length = 0
	sceneDataRef.current = sceneData
	render(<SceneEmbedPage projectId="p" sceneId="s" />)
	const props = captured.at(-1)
	if (!props) throw new Error('the embed viewer was never rendered')
	return props
}

describe('the published scene draws its info popover', () => {
	it('draws it for a scene saved before the setting existed', () => {
		// The migration default, asserted where it is actually decided. Every
		// scene in the database today reads back `presentation: undefined`.
		expect(renderPage({}).popover).toBeTruthy()
	})

	it('draws it when the author left it on', () => {
		expect(
			renderPage({ presentation: { showInfoPopover: true } }).popover
		).toBeTruthy()
	})

	it('passes nothing at all when the author switched it off', () => {
		// Omitted rather than rendered-and-hidden: the viewer's slot takes a
		// node, so an author's off has to arrive here as an absent prop.
		expect(
			renderPage({ presentation: { showInfoPopover: false } }).popover
		).toBeUndefined()
	})
})
