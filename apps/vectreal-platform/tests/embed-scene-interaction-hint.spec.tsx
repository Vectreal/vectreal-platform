// @vitest-environment jsdom
/**
 * The first-time hint reaches the published viewer where the author left it
 * on, unless the embedding page says `?hint=0`, and the info popover lists
 * how to move the scene. The viewer is stubbed as in
 * `embed-scene-view-return.spec.tsx`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SceneEmbedPage from '../app/components/scene-embed/scene-embed-page'

import type { ServerSceneData } from '@vctrl/hooks/use-load-model'
import type { VectrealViewerProps } from '@vctrl/viewer'

const captured: VectrealViewerProps[] = []
const scene = { current: {} as ServerSceneData }
const query = { current: '' }

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
	useSearchParams: () => [new URLSearchParams(query.current), () => undefined]
}))

function renderEmbed(sceneData: ServerSceneData, search = '') {
	scene.current = sceneData
	query.current = search
	render(<SceneEmbedPage projectId="p" sceneId="s" />)
	const props = captured.at(-1)
	if (!props) throw new Error('the viewer was never rendered')
	return props
}

beforeEach(() => {
	captured.length = 0
})

const ON = { presentation: { showInteractionHint: true } } as ServerSceneData

describe('the published viewer shows how to interact', () => {
	it('not for a scene that says nothing', () => {
		expect(renderEmbed({} as ServerSceneData).showInteractionHint).toBe(false)
	})

	it('where the author left it on', () => {
		expect(renderEmbed(ON).showInteractionHint).toBe(true)
	})

	it('unless the embedding page withholds it', () => {
		expect(renderEmbed(ON, 'hint=0').showInteractionHint).toBe(false)
	})
})

describe('the info popover says how to move', () => {
	it('with the block the viewer fills from the keys it takes', () => {
		// The viewer is stubbed here; `info-popover-how-to-move.spec.tsx`
		// renders the block inside a viewer's keys.
		const popover = readFileSync(
			join(
				import.meta.dirname,
				'../app/components/scene-embed/scene-embed-info-popover.tsx'
			),
			'utf8'
		)
		expect(popover).toContain('<InfoPopoverHowToMove />')
	})
})
