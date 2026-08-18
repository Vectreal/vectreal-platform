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

/**
 * server.mjs writes the same three conditions out at the redirect itself, so a
 * reader of the line that hands a value to a browser can see that it cannot
 * name another host. This asserts the normalizer already satisfies them, which
 * is what makes that inline guard a second line of defence rather than the only
 * one.
 */
describe('the guarantee the redirect relies on', () => {
	it('passes the checks written at the sink', () => {
		for (const input of [
			'//evil.com/',
			'//evil.com',
			'///evil.com/',
			'/\\evil.com/',
			'/\\\\evil.com',
			'//\\/evil.com/',
			'\\\\evil.com/',
			'/docs/',
			'/pricing/',
			'/'
		]) {
			const target = toSinglePathForm(input)

			expect(target.startsWith('/')).toBe(true)
			expect(target.startsWith('//')).toBe(false)
			expect(target.startsWith('/\\')).toBe(false)
		}
	})
})
