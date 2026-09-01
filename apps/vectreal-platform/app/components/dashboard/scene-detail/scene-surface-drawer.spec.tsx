// @vitest-environment jsdom
/**
 * One door, one drawer, one set of rules - for both scene detail surfaces.
 *
 * Publish & Embed and Scene details were built separately and drifted at once:
 * one opened from the right at every width, the other from the bottom. Two
 * surfaces of the same kind opening from different edges on the same phone is
 * the inconsistency a user feels first, so the behaviour lives in one component
 * and is asserted in one file.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { SceneSurfaceDrawer } from './scene-surface-drawer'

globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

/**
 * The viewport, as `matchMedia` reports it.
 *
 * A knob rather than a fixed stub: the direction rule is the whole subject of
 * this file, and with `matches` pinned to one value only one edge of it can be
 * asserted - which is exactly how the two surfaces drifted apart.
 */
let hasAside = false

window.matchMedia = ((query: string) => ({
	matches: hasAside,
	media: query,
	onchange: null,
	addListener: () => {},
	removeListener: () => {},
	addEventListener: () => {},
	removeEventListener: () => {},
	dispatchEvent: () => false
})) as typeof window.matchMedia

beforeEach(() => {
	hasAside = false
})

function renderDrawer() {
	return render(
		<SceneSurfaceDrawer
			label="Scene details"
			summary="7 assets · 618 KB"
			description="What this scene weighs."
		>
			<p>behind the door</p>
		</SceneSurfaceDrawer>
	)
}

const open = () => fireEvent.click(screen.getByRole('button'))
const content = () =>
	document.querySelector('[data-slot="drawer-content"]') as HTMLElement

describe('the direction follows the layout, not the surface', () => {
	it('opens from the bottom where the page is one stacked column', () => {
		renderDrawer()
		open()

		expect(content().getAttribute('data-vaul-drawer-direction')).toBe('bottom')
	})

	it('opens from the right once there is an aside beside it', () => {
		hasAside = true
		renderDrawer()
		open()

		expect(content().getAttribute('data-vaul-drawer-direction')).toBe('right')
	})

	it('withholds the panel width from a bottom sheet', () => {
		/*
		  The trap this component exists to make unhittable, and the reason the
		  width lives here rather than at each call site. A bottom `DrawerContent`
		  is `inset-x-0`, so a max-width on it with no `mx-auto` pins the sheet to
		  the left edge of the phone instead of filling it.
		*/
		renderDrawer()
		open()

		expect(content().className).not.toContain('max-w-detail-panel')
	})

	it('takes the panel width when it opens from the side', () => {
		hasAside = true
		renderDrawer()
		open()

		expect(content().className).toContain('max-w-detail-panel')
	})
})

describe('the door', () => {
	it('says what is behind it before it is opened', () => {
		renderDrawer()

		const door = screen.getByRole('button')
		expect(door.textContent).toContain('Scene details')
		expect(door.textContent).toContain('7 assets · 618 KB')
	})

	it('costs nothing until it is opened', () => {
		/*
		  The point of a door. Content mounted with the page would put the thing it
		  hides back in the document, and the only thing gained would be that it is
		  invisible.
		*/
		renderDrawer()

		expect(screen.queryByText('behind the door')).toBeNull()

		open()

		expect(screen.getByText('behind the door')).not.toBeNull()
	})

	it('titles the drawer with the same words as the door', () => {
		/*
		  One label, so a door and the surface it opens cannot come to be called
		  different things.
		*/
		renderDrawer()
		open()

		expect(
			screen.getByRole('heading', { name: 'Scene details' })
		).not.toBeNull()
	})
})
