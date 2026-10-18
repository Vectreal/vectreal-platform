import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The social sign-in throttle, through the real action.
 *
 * It runs before the provider is validated, so invalid-provider probes are
 * throttled too. It used to key on the raw form value, though, which made the
 * throttle per value: a caller rotating `provider` got a fresh counter on
 * every request and was never refused.
 */

vi.mock('../app/lib/http/csrf.server', () => ({
	ensureValidCsrfFormData: vi.fn(async () => null)
}))

vi.mock('../app/lib/http/turnstile.server', () => ({
	verifyTurnstileToken: vi.fn(async () => ({ success: true }))
}))

vi.mock('../app/lib/supabase.server', () => ({
	createSupabaseClient: vi.fn(async () => ({
		client: {
			auth: {
				signInWithOAuth: vi.fn(async () => ({
					data: { url: 'https://accounts.example/authorize' },
					error: null
				}))
			}
		},
		headers: new Headers()
	}))
}))

import { __resetRateLimitsForTest } from '../app/lib/http/rate-limit.server'
import { action } from '../app/routes/api/auth/social-signin'

/** The bucket's limit in a 60s window. */
const LIMIT = 30

function signIn(provider: string) {
	const body = new FormData()
	body.set('provider', provider)

	return action({
		request: new Request('https://vectreal.com/auth/social-signin', {
			method: 'POST',
			headers: { 'cf-connecting-ip': '203.0.113.10' },
			body
		}),
		params: {},
		context: {}
	} as never) as Promise<Response>
}

beforeEach(() => {
	__resetRateLimitsForTest()
})

describe('the social sign-in throttle', () => {
	it('cannot be reset by rotating the provider value', async () => {
		for (let n = 1; n <= LIMIT; n += 1) {
			expect((await signIn(`probe-${n}`)).status, `probe ${n}`).toBe(400)
		}

		expect((await signIn('probe-fresh')).status).toBe(429)
	})

	it('keeps a real provider apart from the probes', async () => {
		for (let n = 1; n <= LIMIT; n += 1) {
			await signIn(`probe-${n}`)
		}

		const response = await signIn('google')
		expect(response.status).toBe(302)
	})
})

/*
  The per-email auth buckets each need an address ceiling beside them, or one
  address can spray a password across accounts or mail unlimited inboxes. The
  limiter's spec proves the ceiling works; this proves each route asks for it.
  Read from source, because these page modules reach the database on import.
*/
describe('the per-email auth buckets', () => {
	it.each([
		['routes/signin-page/signin-page.tsx', 'auth-signin'],
		['routes/signup-page/signup-page.tsx', 'auth-signup'],
		['routes/forgot-password-page/forgot-password.tsx', 'auth-password-reset'],
		['routes/confirm-pending.tsx', 'auth-email-resend']
	])('%s gives %s an address ceiling', (file, bucket) => {
		const source = readFileSync(
			join(import.meta.dirname, '..', 'app', file),
			'utf8'
		)
		const call = source.slice(source.indexOf(`bucket: '${bucket}'`))
		const options = call.slice(0, call.indexOf('})'))

		expect(options).toMatch(/keyParts: \[/)
		expect(options).toMatch(/addressCeiling: \d+/)
	})
})
