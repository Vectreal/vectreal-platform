// @vitest-environment jsdom
/**
 * Where each surface hears that a hotspot's camera holds the view.
 *
 * The pill's own spec covers what it does with an off-list label; this covers
 * the hops that hand it one, because a label nothing passes is the shape of
 * defect that ships green: the pill would go on claiming the default camera
 * while every rule beneath it passed.
 *
 * `SceneEmbedViewer` is stubbed, as in the `embed-scene-*` seam specs, so no
 * viewer internals load and the camera event is fired by hand.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, render, screen } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { describe, expect, it, vi } from 'vitest'

import PreviewCameraControls from '../app/components/publisher/preview-camera-controls'
import PreviewChrome from '../app/components/scene-embed/preview-chrome/preview-chrome'
import SceneEmbedPage, {
	type SceneEmbedViewerControl
} from '../app/components/scene-embed/scene-embed-page'
import { enterPreviewModeAtom } from '../app/lib/stores/publisher-config-store'
import {
	cameraAtom,
	hotspotsAtom,
	selectedCameraIdAtom
} from '../app/lib/stores/scene-settings-store'

import type { ServerSceneData } from '@vctrl/hooks/use-load-model'
import type { ViewerInteractionEvent } from '@vctrl/viewer'
import type { ComponentProps } from 'react'

type SceneEmbedViewerProps = ComponentProps<
	typeof import('../app/components/scene-embed/scene-embed-viewer').default
>

const viewer: SceneEmbedViewerProps[] = []

vi.mock('../app/components/scene-embed/scene-embed-viewer', () => ({
	default: (props: SceneEmbedViewerProps) => {
		viewer.push(props)
		return null
	}
}))

const SCENE = {
	camera: {
		cameras: [
			{ cameraId: 'front', name: 'Front', initial: true },
			{ cameraId: 'hotspot-camera-1', name: 'Handle camera', kind: 'hotspot' }
		]
	},
	hotspots: [
		{
			id: 'handle',
			name: 'Handle',
			worldPosition: [0, 0, 0],
			visible: true,
			internalOnly: false,
			stylePreset: 'dot',
			linkedCameraId: 'hotspot-camera-1'
		}
	]
} as unknown as Partial<ServerSceneData>

vi.mock('../app/components/scene-embed/use-scene-embed-scene', () => ({
	useSceneEmbedScene: () => ({
		file: { model: {} },
		isLoadingScene: false,
		sceneData: SCENE,
		loadError: null,
		retrySceneLoad: () => Promise.resolve()
	})
}))

vi.mock('../app/lib/domain/embed/hosted-preview-bridge', () => ({
	useHostedPreviewBridge: () => ({})
}))

vi.mock('react-router', () => ({
	useSearchParams: () => [new URLSearchParams(), () => undefined],
	useNavigate: () => () => undefined
}))

describe('/preview and /embed', () => {
	it('tell the chrome which hotspot holds the view', () => {
		const controls: SceneEmbedViewerControl[] = []
		render(
			<SceneEmbedPage
				projectId="p"
				sceneId="s"
				chrome={(control) => {
					controls.push(control)
					return null
				}}
			/>
		)
		const fire = (event: ViewerInteractionEvent) =>
			act(() => viewer.at(-1)?.onInteractionEvent?.(event))

		fire({ type: 'camera_changed', cameraId: 'front' })
		expect(controls.at(-1)?.activeHotspotName).toBeNull()

		fire({ type: 'camera_changed', cameraId: 'hotspot-camera-1' })
		expect(controls.at(-1)?.activeHotspotName).toBe('Handle')
	})
})

describe('the /preview chrome', () => {
	it('names the hotspot view in its pill', () => {
		render(
			<PreviewChrome
				backTo="/dashboard"
				cameras={[{ cameraId: 'front', name: 'Front' }]}
				activeCameraId="hotspot-camera-1"
				activeHotspotName="Handle"
				onSelectCamera={() => undefined}
			/>
		)

		expect(screen.getByText('Handle')).toBeTruthy()
		expect(screen.queryByText('Front')).toBeNull()
	})
})

describe('the publisher preview', () => {
	it('names the hotspot view in its pill', () => {
		const store = createStore()
		store.set(cameraAtom, SCENE.camera as never)
		store.set(hotspotsAtom, SCENE.hotspots as never)
		store.set(enterPreviewModeAtom)
		store.set(selectedCameraIdAtom, 'hotspot-camera-1')

		render(
			<Provider store={store}>
				<PreviewCameraControls />
			</Provider>
		)

		expect(screen.getByText('Handle')).toBeTruthy()
		expect(screen.queryByText('Front')).toBeNull()
	})

	it('offers the way back only while previewing, not in the editor', () => {
		// The route mounts the whole publisher, so the one line is pinned here.
		const route = readFileSync(
			join(
				import.meta.dirname,
				'../app/routes/publisher-page/publisher.$sceneId.tsx'
			),
			'utf8'
		)
		expect(route).toContain('showSceneViewReturn={isPreviewMode}')
	})

	it('picks markers up for editing outside preview, never flies them', () => {
		const route = readFileSync(
			join(
				import.meta.dirname,
				'../app/routes/publisher-page/publisher.$sceneId.tsx'
			),
			'utf8'
		)
		const handler = route.slice(
			route.indexOf('const handleHotspotSelect'),
			route.indexOf('const cameraOptions')
		)
		// Preview passes nothing, which is what gives a marker the visitor's flight.
		expect(handler).toContain('if (isPreviewMode) return undefined')
		// Outside the Hotspot tool a click opens it on that hotspot.
		expect(handler).toContain('return openHotspotInHotspotTool')
	})

	it('starts a loaded scene with no hotspot mode to put a camera back from', () => {
		const loader = readFileSync(
			join(
				import.meta.dirname,
				'../app/hooks/scene-loader/use-scene-settings.ts'
			),
			'utf8'
		)
		expect(loader.match(/resetHotspotEditing\(\)/g)).toHaveLength(2)
		expect(loader).not.toContain('setActiveHotspotId(null)')
	})
})
