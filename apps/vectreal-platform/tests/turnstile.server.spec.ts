import { verifyTurnstileToken } from '../app/lib/http/turnstile.server'

describe('verifyTurnstileToken', () => {
	const originalNodeEnv = process.env.NODE_ENV
	const originalSecret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY
	const originalFetch = global.fetch
	const request = new Request('https://vectreal.com/sign-in', {
		headers: {
			'cf-connecting-ip': '203.0.113.10'
		}
	})

	afterEach(() => {
		process.env.NODE_ENV = originalNodeEnv
		process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = originalSecret
		global.fetch = originalFetch
	})

	it('bypasses verification in non-production when secret key is missing', async () => {
		process.env.NODE_ENV = 'development'
		delete process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY

		const result = await verifyTurnstileToken('')

		expect(result).toEqual({ success: true })
	})

	it('returns failure when token is missing and secret exists', async () => {
		process.env.NODE_ENV = 'production'
		process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = 'secret'

		const result = await verifyTurnstileToken('')

		expect(result).toEqual({
			success: false,
			errorCodes: ['missing-input-response']
		})
	})

	it('returns success when Cloudflare verification succeeds', async () => {
		process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = 'secret'
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ success: true, hostname: 'vectreal.com' })
		} as Response)

		const result = await verifyTurnstileToken('token', request)

		expect(result).toEqual({ success: true })
		expect(global.fetch).toHaveBeenCalledTimes(1)
		const [, init] = vi.mocked(global.fetch).mock.calls[0]
		const body = init?.body as URLSearchParams
		expect(body.get('response')).toBe('token')
		expect(body.get('secret')).toBe('secret')
		expect(body.get('remoteip')).toBe('203.0.113.10')
		expect(body.get('idempotency_key')).toBeTruthy()
	})

	it('returns failure with error codes when Cloudflare verification fails', async () => {
		process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = 'secret'
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				success: false,
				'error-codes': ['invalid-input-response']
			})
		} as Response)

		const result = await verifyTurnstileToken('token')

		expect(result).toEqual({
			success: false,
			errorCodes: ['invalid-input-response']
		})
	})

	it('returns failure when Cloudflare reports a hostname mismatch', async () => {
		process.env.NODE_ENV = 'production'
		process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = 'secret'
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ success: true, hostname: 'attacker.example' })
		} as Response)

		const result = await verifyTurnstileToken('token', request)

		expect(result).toEqual({
			success: false,
			errorCodes: ['hostname-mismatch']
		})
	})
})
