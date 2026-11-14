// @vitest-environment jsdom
/**
 * The viewer's default loader speaks the viewer's language and draws with its
 * own classes.
 *
 * Mutation gates, executed: pass English words instead of the catalog's and
 * the German test goes red; ignore the load clock and the delay test goes red.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ViewerLoadClockContext, ViewerLoadProgress } from './load-progress'
import { ViewerMessagesContext } from './viewer-messages'
import { de } from '../locales/de'

describe('ViewerLoadProgress', () => {
	it('names the phase and counts files in the viewer’s language', () => {
		render(
			<ViewerMessagesContext.Provider value={de}>
				<ViewerLoadProgress
					progress={{ phase: 'parsing', items: { loaded: 3, total: 8 } }}
				/>
			</ViewerMessagesContext.Provider>
		)

		const bar = screen.getByRole('progressbar', { hidden: true })
		expect(bar.getAttribute('aria-label')).toBe('Modell wird gelesen')
		expect(bar.getAttribute('aria-valuetext')).toBe('3 von 8 Dateien')
	})

	it('draws only with the viewer’s own prefixed classes', () => {
		const { container } = render(
			<ViewerLoadProgress progress={{ phase: 'preparing' }} />
		)
		const classes = [...container.querySelectorAll('[class]')].flatMap(
			(element) => element.getAttribute('class')?.split(/\s+/) ?? []
		)
		expect(classes.length).toBeGreaterThan(0)
		expect(classes.filter((name) => name && !name.startsWith('vv:'))).toEqual(
			[]
		)
	})
	it('counts its delay from the load, not from its own mount', () => {
		const { container } = render(
			<ViewerLoadClockContext.Provider value={Date.now() - 1000}>
				<ViewerLoadProgress progress={{ phase: 'preparing' }} />
			</ViewerLoadClockContext.Provider>
		)
		expect(container.firstElementChild?.getAttribute('class')).not.toContain(
			'vv:invisible'
		)
	})
})
