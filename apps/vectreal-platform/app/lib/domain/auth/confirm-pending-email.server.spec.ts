import { describe, expect, it } from 'vitest'

import {
	clearConfirmPendingEmail,
	readConfirmPendingEmail,
	redirectToConfirmPending
} from './confirm-pending-email.server'

/**
 * The address a confirmation email went to used to ride in
 * `/auth/confirm-pending?email=`, and from there into every analytics event,
 * the request log and browser history. It travels in a cookie instead.
 */

const ORIGIN = 'https://vectreal.com'

function cookieHeaderFrom(setCookie: string): string {
	return setCookie.split(';')[0]
}

describe('redirectToConfirmPending', () => {
	it('leaves the address out of the URL and keeps next', async () => {
		const response = await redirectToConfirmPending(
			new Request(`${ORIGIN}/sign-up`, { method: 'POST' }),
			'jane.doe@example.com',
			'/onboarding'
		)

		const location = new URL(response.headers.get('Location') ?? '')
		expect(location.pathname).toBe('/auth/confirm-pending')
		expect(location.searchParams.get('next')).toBe('/onboarding')
		expect(location.toString()).not.toMatch(/jane|example/)
	})

	it('sets an httpOnly cookie that single fetch requests also carry', async () => {
		const response = await redirectToConfirmPending(
			new Request(`${ORIGIN}/sign-in`, { method: 'POST' }),
			'jane.doe@example.com',
			'/'
		)
		const setCookie = response.headers.get('Set-Cookie') ?? ''

		expect(setCookie).toMatch(/HttpOnly/i)
		expect(setCookie).toMatch(/SameSite=Lax/i)
		// `/auth/confirm-pending.data` is outside a `/auth/confirm-pending` path.
		expect(setCookie).toMatch(/Path=\/auth(;|$)/)
	})

	it('hands the address to the confirm-pending page through the cookie', async () => {
		const response = await redirectToConfirmPending(
			new Request(`${ORIGIN}/sign-up`, { method: 'POST' }),
			'jane.doe@example.com',
			'/'
		)
		const cookie = cookieHeaderFrom(response.headers.get('Set-Cookie') ?? '')

		expect(
			await readConfirmPendingEmail(
				new Request(`${ORIGIN}/auth/confirm-pending.data`, {
					headers: { Cookie: cookie }
				})
			)
		).toBe('jane.doe@example.com')
	})
})

describe('readConfirmPendingEmail', () => {
	it('is null without the cookie', async () => {
		expect(
			await readConfirmPendingEmail(
				new Request(`${ORIGIN}/auth/confirm-pending`)
			)
		).toBeNull()
	})

	it('is null once the cookie is cleared', async () => {
		const cleared = cookieHeaderFrom(await clearConfirmPendingEmail())

		expect(
			await readConfirmPendingEmail(
				new Request(`${ORIGIN}/auth/confirm-pending`, {
					headers: { Cookie: cleared }
				})
			)
		).toBeNull()
		expect(await clearConfirmPendingEmail()).toMatch(/Max-Age=0/)
	})

	it('ignores an address passed in the URL', async () => {
		expect(
			await readConfirmPendingEmail(
				new Request(`${ORIGIN}/auth/confirm-pending?email=a%40example.com`)
			)
		).toBeNull()
	})
})
