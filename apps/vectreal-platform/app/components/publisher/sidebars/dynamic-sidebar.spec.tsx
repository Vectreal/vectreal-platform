// @vitest-environment jsdom
/**
 * Every desktop panel can be closed.
 *
 * The close button used to live only inside the built-in desktop header. The
 * optimization panel draws a header of its own, so when its hand-rolled close
 * was removed for doubling the mobile drawer's, the desktop panel was left with
 * no way out at all: no button, and it is not a dialog, so no Escape either.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DynamicSidebar } from './dynamic-sidebar'

function renderPanel(
	props: Partial<Parameters<typeof DynamicSidebar>[0]> = {}
) {
	const onOpenChange = vi.fn()
	render(
		<DynamicSidebar
			open
			onOpenChange={onOpenChange}
			isMobile={false}
			title="Optimize Scene"
			{...props}
		>
			<p>content</p>
		</DynamicSidebar>
	)
	return onOpenChange
}

describe('a desktop panel', () => {
	it('can be closed when it draws its own header', () => {
		const onOpenChange = renderPanel()

		fireEvent.click(screen.getByRole('button', { name: 'Close' }))

		expect(onOpenChange).toHaveBeenCalledWith(false)
	})

	it('can be closed from the built-in header, with one button', () => {
		const onOpenChange = renderPanel({ showDesktopHeader: true })

		fireEvent.click(screen.getByRole('button', { name: 'Close' }))

		expect(onOpenChange).toHaveBeenCalledWith(false)
	})

	it('offers no close while closing is blocked', () => {
		renderPanel({ closeDisabled: true })

		expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
	})
})
