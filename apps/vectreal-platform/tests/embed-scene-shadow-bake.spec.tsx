// @vitest-environment jsdom
/**
 * A published scene without a usable stored bake fades its shadow in rather
 * than freezing the page to bake it.
 *
 * `staticShadowBake` bakes every frame of the shadow inside one layout effect,
 * which held the main thread for the whole bake while the loader's spinner
 * stood still. A stored bake still loads as before; this covers the scenes
 * that have none, or whose bake no longer matches the model.
 *
 * Stubs `ClientVectrealViewer` for the same reason as
 * `embed-scene-hotspots.spec.tsx`: what matters is the props handed over.
 */
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import SceneEmbedViewer from '../app/components/scene-embed/scene-embed-viewer'

import type { VectrealViewerProps } from '@vctrl/viewer'

const captured: VectrealViewerProps[] = []

vi.mock('../app/components/viewer/client-vectreal-viewer', () => ({
	ClientVectrealViewer: (props: VectrealViewerProps) => {
		captured.push(props)
		return null
	}
}))

describe('the published scene’s shadow bake', () => {
	it('is never asked to run in one blocking pass', () => {
		render(<SceneEmbedViewer file={null} theme="system" />)
		const props = captured.at(-1)
		if (!props) throw new Error('the viewer was never rendered')
		expect(props.staticShadowBake).toBeFalsy()
	})
})
