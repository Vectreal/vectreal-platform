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

import type { ServerSceneData } from '@vctrl/hooks/use-load-model'
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

	describe('stored with the basis it was baked on', () => {
		const basis = { footprint: 1.2, radius: 0.9, vertexCount: 18_432 }
		const bakeRef = {
			url: '/api/scenes/s1/assets/bake-1?exp=1&sig=abc',
			fileName: 'shadow-bake.png',
			mimeType: 'image/png',
			byteSize: 4
		}
		const sceneData = (withBasis: boolean) =>
			({
				gltfJson: null,
				assetData: {},
				assetRefs: { 'bake-1': bakeRef },
				shadows: {
					enabled: true,
					baked: {
						assetId: 'bake-1',
						signature: 'sig',
						...(withBasis ? { basis } : {})
					}
				}
			}) as unknown as ServerSceneData

		it('hands the viewer that basis, so the published model cannot void it', () => {
			render(
				<SceneEmbedViewer
					file={null}
					sceneData={sceneData(true)}
					theme="system"
				/>
			)
			expect(captured.at(-1)?.bakedShadow).toEqual({
				url: bakeRef.url,
				signature: 'sig',
				basis
			})
		})

		it('hands over no basis for a bake saved before it was recorded', () => {
			render(
				<SceneEmbedViewer
					file={null}
					sceneData={sceneData(false)}
					theme="system"
				/>
			)
			expect(captured.at(-1)?.bakedShadow).not.toHaveProperty('basis')
		})
	})
})
