// @vitest-environment jsdom
/**
 * The last hop of the funnel: the published scene draws the hotspots the
 * manifest carried, and never the ones it was not supposed to.
 *
 * This is a seam test, and it is here because the seam is what broke. A
 * complete hotspot renderer shipped in `@vctrl/viewer`, the server persisted
 * and redacted hotspots correctly, and every one of those halves had tests -
 * but nothing passed `hotspots` from one to the other, so a published scene
 * showed nothing at all and no suite noticed.
 *
 * `ClientVectrealViewer` is stubbed rather than `@vctrl/viewer` itself: it is
 * one level below the package, so no viewer internals (or WebGL) load, and what
 * we care about is the props this component hands over.
 */
import { render } from '@testing-library/react'
import { resolveHotspotMarkers } from '@vctrl/viewer/hotspots'
import { describe, expect, it, vi } from 'vitest'

import SceneEmbedViewer from '../app/components/scene-embed/scene-embed-viewer'

import type { HotspotDefinition } from '@vctrl/core'
import type { ServerSceneData } from '@vctrl/hooks/use-load-model'
import type { VectrealViewerProps } from '@vctrl/viewer'

/*
  An array rather than a `let`. A module-level mutable assigned only inside a
  callback narrows to its initializer, so `if (!lastProps) throw` left every
  later read typed `never`; reading the last element gives a fresh const that
  narrows the ordinary way.
*/
const captured: VectrealViewerProps[] = []

vi.mock('../app/components/viewer/client-vectreal-viewer', () => ({
	ClientVectrealViewer: (props: VectrealViewerProps) => {
		captured.push(props)
		return null
	}
}))

const hotspot = (
	overrides: Partial<HotspotDefinition> & Pick<HotspotDefinition, 'id'>
): HotspotDefinition => ({
	name: overrides.id,
	worldPosition: [0, 1, 2],
	visible: true,
	internalOnly: false,
	stylePreset: 'dot',
	...overrides
})

const HOTSPOTS = [
	hotspot({ id: 'public', sequenceIndex: 0 }),
	hotspot({ id: 'internal', internalOnly: true }),
	hotspot({ id: 'hidden', visible: false })
]

function renderEmbed(sceneData?: Partial<ServerSceneData>) {
	captured.length = 0
	render(
		<SceneEmbedViewer
			file={null}
			sceneData={sceneData as ServerSceneData | undefined}
			theme="system"
		/>
	)
	const props = captured.at(-1)
	if (!props) throw new Error('the viewer was never rendered')
	return props
}

describe('the published scene draws its hotspots', () => {
	it('hands the scene’s hotspots to the viewer', () => {
		expect(renderEmbed({ hotspots: HOTSPOTS }).hotspots).toEqual(HOTSPOTS)
	})

	it('passes nothing at all when the scene carries none', () => {
		expect(renderEmbed({}).hotspots).toBeUndefined()
	})

	it('never asks the viewer for internal or hidden hotspots', () => {
		/*
		  Two of the three surfaces rendering this component are served the
		  unredacted manifest - the dashboard's scene detail panel, and `/preview`
		  of a scene with no published model row - so `internalOnly` hotspots
		  really do arrive here, and this omission is the only thing stopping them
		  being drawn on those two.
		*/
		const props = renderEmbed({ hotspots: HOTSPOTS })

		expect(props.showInternalHotspots).toBeFalsy()
		expect(props.showHiddenHotspots).toBeFalsy()
	})

	it('draws the public hotspot and neither the internal nor the hidden one', () => {
		// The claim that matters, made across the seam rather than either side of
		// it: these are the props this component actually passes, resolved by the
		// renderer that actually receives them.
		const props = renderEmbed({ hotspots: HOTSPOTS })

		const drawn = resolveHotspotMarkers(props.hotspots, {
			includeInternal: props.showInternalHotspots,
			includeHidden: props.showHiddenHotspots
		})

		expect(drawn.map((marker) => marker.id)).toEqual(['public'])
	})
})
