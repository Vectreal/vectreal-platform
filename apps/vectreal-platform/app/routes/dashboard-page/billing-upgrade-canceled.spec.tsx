// @vitest-environment jsdom
/**
 * The page Stripe returns to when someone abandons a plan change.
 *
 * Its only input is a query parameter Stripe echoes back from the checkout
 * session's cancel URL, which means the reader can also type it. The page used
 * to read it as a key into the display names with a type assertion, so the
 * assertion described a guarantee nothing enforced.
 */

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import BillingUpgradeCanceledPage from './billing-upgrade-canceled'

function renderAt(search: string) {
	return render(
		<MemoryRouter
			initialEntries={[`/dashboard/billing/upgrade-canceled${search}`]}
		>
			<BillingUpgradeCanceledPage />
		</MemoryRouter>
	)
}

describe('the abandoned plan change', () => {
	it('names the plan when the parameter is one', () => {
		renderAt('?plan=pro')

		expect(screen.getByRole('link', { name: /back to pro/i })).toBeTruthy()
	})

	it('offers the plan list when there is no parameter', () => {
		renderAt('')

		expect(screen.getByRole('link', { name: /choose a plan/i })).toBeTruthy()
	})

	/*
	  `toString` is the case that broke it. Every object inherits it, so a lookup
	  by a raw parameter finds a function, a truthy value survives `?? null`, and
	  the button rendered the function's source. Any inherited member does this;
	  this one is just the shortest to type.
	*/
	it('does not treat an inherited property as a plan', () => {
		renderAt('?plan=toString')

		expect(screen.getByRole('link', { name: /choose a plan/i })).toBeTruthy()
		expect(document.body.textContent).not.toContain('native code')
	})

	it('does not treat an unsold plan as one', () => {
		renderAt('?plan=enterprise')

		expect(screen.getByRole('link', { name: /choose a plan/i })).toBeTruthy()
	})
})
