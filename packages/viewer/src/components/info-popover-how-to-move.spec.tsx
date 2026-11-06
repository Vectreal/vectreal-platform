// @vitest-environment jsdom
/**
 * The popover's "How to move" lines follow the keys the viewer takes now,
 * not the scene's saved controls, so a host's override is in them.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { InfoPopoverHowToMove } from './info-popover-how-to-move'
import { ViewerKeysContext } from './viewer-keys-context'

import type { ViewerKeys } from './scene/viewer-keys'

const NONE: ViewerKeys = { rotate: false, zoom: false, pan: false, home: false }

const renderIn = (keys: ViewerKeys | null) =>
	render(
		<ViewerKeysContext.Provider value={keys}>
			<InfoPopoverHowToMove />
		</ViewerKeysContext.Provider>
	)

describe('InfoPopoverHowToMove', () => {
	it('lists each input for the controls that are on', () => {
		renderIn({ ...NONE, rotate: true })
		expect(screen.getByText('How to move')).toBeTruthy()
		expect(screen.getByText('Keyboard')).toBeTruthy()
		expect(screen.getByText('Arrow keys rotate')).toBeTruthy()
		expect(screen.queryByText(/zoom/)).toBeNull()
	})

	it('says nothing when nothing moves, as when a host turned the controls off', () => {
		const { container } = renderIn(NONE)
		expect(container.childElementCount).toBe(0)
	})

	it('says nothing outside a viewer', () => {
		const { container } = renderIn(null)
		expect(container.childElementCount).toBe(0)
	})
})
