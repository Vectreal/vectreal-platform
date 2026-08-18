import { describe, expect, it } from 'vitest'

// @ts-expect-error - plain JS module, shared with the node server which has no build step
import { toSinglePathForm } from '../server-url-form.mjs'

/**
 * The server redirects any other spelling of a path to this form, so whatever
 * this returns ends up in a `Location` header. A value that a browser resolves
 * against a different host would make that redirect an open redirect.
 */
describe('toSinglePathForm', () => {
	it('drops a trailing slash', () => {
		expect(toSinglePathForm('/docs/')).toBe('/docs')
		expect(toSinglePathForm('/docs/guides/upload/')).toBe('/docs/guides/upload')
	})

	it('leaves the canonical form alone', () => {
		expect(toSinglePathForm('/docs')).toBe('/docs')
		expect(toSinglePathForm('/')).toBe('/')
	})

	it('never returns a protocol-relative path', () => {
		for (const attack of [
			'//evil.com/',
			'//evil.com',
			'///evil.com/',
			'/\\evil.com/',
			'/\\\\evil.com',
			'//\\/evil.com/',
			'\\\\evil.com/'
		]) {
			const result = toSinglePathForm(attack)

			expect(result.startsWith('/')).toBe(true)
			expect(result.startsWith('//')).toBe(false)
			expect(result.startsWith('/\\')).toBe(false)
			expect(result).not.toContain('evil.com/')
		}
	})

	it('collapses a path that is only separators to the root', () => {
		expect(toSinglePathForm('//')).toBe('/')
		expect(toSinglePathForm('\\\\')).toBe('/')
	})

	it('is idempotent', () => {
		for (const input of ['/docs/', '//evil.com/', '/\\evil.com/', '/']) {
			const once = toSinglePathForm(input)

			expect(toSinglePathForm(once)).toBe(once)
		}
	})
})
