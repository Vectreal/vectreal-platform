// @vitest-environment jsdom
/**
 * The embed SDK hears the viewer is ready only once the scene is.
 *
 * The bridge answers the host page's ping with the scene's cameras and
 * hotspots and runs the author's `viewer_ready` interactions the moment it
 * gets an executor. The viewer mounts while the scene is still loading and
 * registers its executor then, so handing it straight over resolved the SDK's
 * `ready()` with no cameras and ran no interactions at all.
 */
import { render } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'

import SceneEmbedPage from '../app/components/scene-embed/scene-embed-page'

import type { ServerSceneData } from '@vctrl/hooks/use-load-model'
import type { VectrealViewerProps } from '@vctrl/viewer'

const executor = { execute: vi.fn() }
const bridgeCalls: unknown[] = []

vi.mock('../app/components/viewer/client-vectreal-viewer', () => ({
	ClientVectrealViewer: (props: VectrealViewerProps) => {
		useEffect(() => {
			props.onCommandExecutorReady?.(executor)
		}, [props])
		return null
	}
}))

vi.mock('../app/lib/domain/embed/hosted-preview-bridge', () => ({
	useHostedPreviewBridge: () => ({
		onCommandExecutorReady: (value: unknown) => bridgeCalls.push(value)
	})
}))

vi.mock('react-router', () => ({
	useSearchParams: () => [new URLSearchParams(), () => undefined]
}))

const loadState = {
	current: { sceneData: undefined as ServerSceneData | undefined }
}

vi.mock('../app/components/scene-embed/use-scene-embed-scene', () => ({
	useSceneEmbedScene: () => ({
		file: loadState.current.sceneData ? { model: {} } : null,
		sceneData: loadState.current.sceneData,
		loadError: null,
		retrySceneLoad: () => Promise.resolve()
	})
}))

describe('the embed bridge', () => {
	it('is handed the executor only once the scene data has arrived', () => {
		bridgeCalls.length = 0
		loadState.current = { sceneData: undefined }
		const { rerender } = render(<SceneEmbedPage projectId="p" sceneId="s" />)
		expect(bridgeCalls).toEqual([])

		loadState.current = {
			sceneData: { gltfJson: null, assetData: {} } as ServerSceneData
		}
		rerender(<SceneEmbedPage projectId="p" sceneId="s" />)
		expect(bridgeCalls).toEqual([executor])
	})

	it('is not re-announced for new scene data, and is withdrawn when the scene goes', () => {
		bridgeCalls.length = 0
		const sceneData = () =>
			({ gltfJson: null, assetData: {} }) as ServerSceneData
		loadState.current = { sceneData: sceneData() }
		const { rerender } = render(<SceneEmbedPage projectId="p" sceneId="s" />)
		expect(bridgeCalls).toEqual([executor])

		loadState.current = { sceneData: sceneData() }
		rerender(<SceneEmbedPage projectId="p" sceneId="s" />)
		expect(bridgeCalls).toEqual([executor])

		loadState.current = { sceneData: undefined }
		rerender(<SceneEmbedPage projectId="p" sceneId="s" />)
		expect(bridgeCalls).toEqual([executor, null])
	})
})
