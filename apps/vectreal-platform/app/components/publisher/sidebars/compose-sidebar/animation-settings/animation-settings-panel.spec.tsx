// @vitest-environment jsdom
/**
 * The Animation tool's contracts with the scene it edits: it says so plainly
 * when the model has nothing to play, it writes nothing until the author acts,
 * its first edit writes a whole config, and the preview scrubber drives the
 * viewer without touching the saved settings.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { AnimationClip } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AnimationSettingsPanel from './animation-settings-panel'
import {
	animationAtom,
	animationDriftAtom
} from '../../../../../lib/stores/scene-settings-store'

import type { AnimationSettings } from '@vctrl/core'
import type { ViewerCommand } from '@vctrl/viewer'

// The sliders measure themselves; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
}

const model = vi.hoisted(() => ({
	animations: [] as AnimationClip[]
}))
const execute = vi.hoisted(() => vi.fn<(command: ViewerCommand) => void>())

vi.mock('@vctrl/hooks/use-load-model', () => ({
	useModelContext: () => ({
		status: 'ready',
		file: { animations: model.animations }
	})
}))

vi.mock('../../../publisher-viewer-capture-context', () => ({
	usePublisherViewerCapture: () => ({
		commandExecutor: { current: { execute } }
	})
}))

const renderPanel = (store = createStore()) => {
	render(
		<Provider store={store}>
			<AnimationSettingsPanel />
		</Provider>
	)
	return store
}

const switchNamed = (name: string) => screen.getByRole('switch', { name })

beforeEach(() => {
	model.animations = [
		new AnimationClip('Walk', 1.2, []),
		new AnimationClip('Run', 0.8, [])
	]
	execute.mockClear()
})

describe('AnimationSettingsPanel', () => {
	it('explains that clips come from the file when the model has none', () => {
		model.animations = []
		renderPanel()

		expect(screen.getByText(/This model has no animation clips/)).toBeTruthy()
		expect(screen.queryByRole('switch', { name: 'Play animation' })).toBeNull()
	})

	it('shows a model with clips as off and writes nothing on open', () => {
		const store = renderPanel()

		expect(switchNamed('Play animation').getAttribute('aria-checked')).toBe(
			'false'
		)
		expect(screen.getByText(/has 2 animation clips/)).toBeTruthy()
		expect(store.get(animationAtom)).toBeUndefined()
	})

	it("writes a whole config, listing every clip, on the author's first edit", () => {
		const store = renderPanel()

		fireEvent.click(switchNamed('Play animation'))

		expect(store.get(animationAtom)).toMatchObject({
			enabled: true,
			mode: 'simultaneous',
			clips: [
				{ sourceName: 'Walk', enabled: true, order: 0 },
				{ sourceName: 'Run', enabled: true, order: 1 }
			]
		})
	})

	it('reorders a sequence from the list', () => {
		const store = renderPanel()
		fireEvent.click(switchNamed('Play animation'))
		fireEvent.click(screen.getByRole('radio', { name: 'In order' }))

		fireEvent.click(screen.getByRole('button', { name: 'Move Run earlier' }))

		const clips = store.get(animationAtom)?.clips ?? []
		expect(
			[...clips]
				.sort((a, b) => a.order - b.order)
				.map((clip) => clip.sourceName)
		).toEqual(['Run', 'Walk'])
	})

	it('scrubs a clip by pausing and seeking, and never saves the position', async () => {
		const store = renderPanel()
		fireEvent.click(switchNamed('Play animation'))
		const before = store.get(animationAtom)
		const walkId = before?.clips.find(
			(clip) => clip.sourceName === 'Walk'
		)?.clipId

		fireEvent.click(screen.getByRole('button', { name: /^Walk/ }))
		fireEvent.keyDown(await screen.findByRole('slider', { name: 'Position' }), {
			key: 'ArrowRight'
		})

		expect(execute.mock.calls.map(([command]) => command)).toEqual([
			{ type: 'set_animation_playing', playing: false },
			{ type: 'seek_animation_clip', clipId: walkId, time: 0.01 }
		])
		expect(store.get(animationAtom)).toBe(before)
	})

	it('tells the author what reconciling against the model changed', () => {
		const store = createStore()
		store.set(animationDriftAtom, {
			added: ['Jump'],
			dropped: [],
			remapped: []
		})
		renderPanel(store)

		expect(screen.getByText(/1 new clip/)).toBeTruthy()
	})

	describe('a slider edit still inside its commit delay', () => {
		const dragSpeedOnWalk = async (store: ReturnType<typeof createStore>) => {
			const view = render(
				<Provider store={store}>
					<AnimationSettingsPanel />
				</Provider>
			)
			fireEvent.click(switchNamed('Play animation'))
			fireEvent.click(screen.getByRole('button', { name: /^Walk/ }))
			fireEvent.keyDown(await screen.findByRole('slider', { name: 'Speed' }), {
				key: 'ArrowRight'
			})
			return view
		}
		const walkSpeed = (store: ReturnType<typeof createStore>) =>
			store.get(animationAtom)?.clips.find((clip) => clip.sourceName === 'Walk')
				?.timeScale

		it('lands when the panel closes before the delay runs out', async () => {
			const store = createStore()
			const { unmount } = await dragSpeedOnWalk(store)
			expect(walkSpeed(store)).toBe(1)

			unmount()

			expect(walkSpeed(store)).toBe(1.05)
		})

		it('gives way to a config written underneath it', async () => {
			const store = createStore()
			await dragSpeedOnWalk(store)
			const otherScene: AnimationSettings = {
				enabled: false,
				mode: 'sequence',
				autoplay: false,
				loopSequence: false,
				showControls: false,
				clips: []
			}

			act(() => store.set(animationAtom, otherScene))
			await act(() => new Promise((resolve) => setTimeout(resolve, 400)))

			expect(store.get(animationAtom)).toBe(otherScene)
		})
	})
})
