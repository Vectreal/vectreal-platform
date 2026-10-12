/**
 * The ticket rules on their own, for the cases no ModelOptimizer caller can
 * reach today: every caller commits right after its own staleness check, so
 * only this pins that a commit itself refuses a ticket that is not current.
 */
import { describe, expect, it } from 'vitest'

import { DocumentCurrency, SupersededError } from './document-currency'

describe('DocumentCurrency', () => {
	it('refuses to commit a ticket a later commit retired', () => {
		const currency = new DocumentCurrency()
		const first = currency.currentTicket()
		const second = currency.currentTicket()

		currency.commit(second)

		expect(() => currency.commit(first)).toThrow(SupersededError)
	})

	it('refuses to commit a ticket a newer model retired', () => {
		const currency = new DocumentCurrency()
		const stale = currency.currentTicket()
		currency.settle(currency.claimModel())

		expect(() => currency.commit(stale)).toThrow(SupersededError)
	})

	it('hands out no ticket while a claimed document is pending', () => {
		const currency = new DocumentCurrency()
		const claim = currency.claimDocument()

		expect(() => currency.currentTicket()).toThrow(SupersededError)
		currency.release(claim)
		expect(() => currency.currentTicket()).not.toThrow()
	})
})
