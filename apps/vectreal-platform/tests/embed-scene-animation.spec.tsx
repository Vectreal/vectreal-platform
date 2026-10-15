// @vitest-environment jsdom
/**
 * A published scene plays the animation its author saved.
 *
 * The viewer mounts no animation runtime without both halves: the clips parsed
 * from the model and the scene's settings for them. `SceneEmbedViewer` is what
 * the embed, `/preview` and the dashboard's scene preview all render, so a
 * prop dropped here stills every animated scene on all three.
 *
 * Stubs `ClientVectrealViewer` for the same reason as
 * `embed-scene-hotspots.spec.tsx`: what matters is the props handed over.
 */
import { render } from '@testing-library/react'
import { AnimationClip, Object3D } from 'three'
import { describe, expect, it, vi } from 'vitest'

import SceneEmbedViewer from '../app/components/scene-embed/scene-embed-viewer'

import type { AnimationSettings } from '@vctrl/core'
import type { ModelFile, ServerSceneData } from '@vctrl/hooks/use-load-model'
import type { VectrealViewerProps } from '@vctrl/viewer'

const captured: VectrealViewerProps[] = []

vi.mock('../app/components/viewer/client-vectreal-viewer', () => ({
	ClientVectrealViewer: (props: VectrealViewerProps) => {
		captured.push(props)
		return null
	}
}))

const animation: AnimationSettings = {
	enabled: true,
	mode: 'simultaneous',
	autoplay: true,
	loopSequence: false,
	showControls: true,
	clips: []
}

describe('an animated published scene', () => {
	it("hands the viewer the model's clips and the saved settings", () => {
		const clips = [new AnimationClip('Walk', 1, [])]
		const file = {
			model: new Object3D(),
			animations: clips,
			type: 'glb',
			name: 'fox.glb'
		} as unknown as ModelFile
		const sceneData = {
			gltfJson: null,
			assetData: {},
			animation
		} as unknown as ServerSceneData

		render(
			<SceneEmbedViewer file={file} sceneData={sceneData} theme="system" />
		)
		const props = captured.at(-1)
		if (!props) throw new Error('the viewer was never rendered')

		expect(props.animations).toBe(clips)
		expect(props.animationOptions).toBe(animation)
	})
})
