import { verifyTurnstileToken } from '../app/lib/http/turnstile.server'

describe('verifyTurnstileToken', () => {
	const originalNodeEnv = process.env.NODE_ENV
	const originalSecret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY
	const originalFetch = global.fetch

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
			json: async () => ({ success: true })
		} as Response)

		const result = await verifyTurnstileToken('token')

		expect(result).toEqual({ success: true })
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
})
