// @vitest-environment jsdom
/**
 * Whether the viewer's DOM chrome is on screen, asserted where the decision is
 * actually made.
 *
 * `overlay-chrome-visibility.spec.ts` pins the rule, and passing it proves
 * nothing about this: the defect was never a wrong predicate, it was a
 * component that consulted one for the playback controls and not for the info
 * popover. So this renders the component and reads the tree.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import Overlay from './overlay'

import type { LoadingState } from '../hooks/use-viewer-loading'

const POPOVER = <div>info popover</div>
const CONTROLS = <div>playback controls</div>
const CAMERAS = <div>camera switcher</div>
const FULLSCREEN = <div>full screen button</div>
const HINT = <div>interaction hint</div>

function renderOverlay(loadingState: LoadingState) {
	render(
		<Overlay
			loadingState={loadingState}
			loader={<div>loading spinner</div>}
			popover={POPOVER}
			animationControls={CONTROLS}
			cameraControls={CAMERAS}
			fullscreenControl={FULLSCREEN}
			interactionHint={HINT}
		/>
	)

	return {
		popover: screen.queryByText('info popover'),
		controls: screen.queryByText('playback controls'),
		cameras: screen.queryByText('camera switcher'),
		fullscreen: screen.queryByText('full screen button'),
		hint: screen.queryByText('interaction hint'),
		loader: screen.queryByText('loading spinner')
	}
}

describe('Overlay', () => {
	it('shows the loader alone while the scene is loading', () => {
		const { popover, controls, cameras, fullscreen, hint, loader } =
			renderOverlay('loading')

		expect(loader).not.toBeNull()
		expect(fullscreen).toBeNull()
		expect(hint).toBeNull()
		// The defect: this popover used to be rendered outside the loader gate,
		// and its `z-[100]` root painted over the spinner for the whole load.
		expect(popover).toBeNull()
		expect(controls).toBeNull()
		expect(cameras).toBeNull()
	})

	it('still shows no chrome during the loader cross-fade', () => {
		const { popover, controls, cameras, loader } = renderOverlay('loaded')

		expect(loader).not.toBeNull()
		expect(popover).toBeNull()
		expect(controls).toBeNull()
		expect(cameras).toBeNull()
	})

	it('shows chrome and no loader once the scene is ready', () => {
		const { popover, controls, cameras, fullscreen, hint, loader } =
			renderOverlay('ready')

		expect(loader).toBeNull()
		expect(fullscreen).not.toBeNull()
		expect(hint).not.toBeNull()
		expect(popover).not.toBeNull()
		expect(controls).not.toBeNull()
		expect(cameras).not.toBeNull()
	})

	it('stacks the full screen button above playback in one corner', () => {
		const { fullscreen, controls } = renderOverlay('ready')

		expect(fullscreen?.parentElement).toBe(controls?.parentElement)
		expect(fullscreen?.nextElementSibling).toBe(controls)
	})
})
