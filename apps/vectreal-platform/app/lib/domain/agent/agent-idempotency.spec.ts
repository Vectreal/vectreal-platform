import { describe, expect, it } from 'vitest'

import { fingerprintRequest, readIdempotencyKey } from './agent-idempotency'

const withKey = (value?: string) =>
	new Request('https://vectreal.com/api/v1/projects', {
		method: 'POST',
		headers: value === undefined ? {} : { 'Idempotency-Key': value }
	})

describe('readIdempotencyKey', () => {
	it('reads an RFC 8941 string, the form the draft specifies', () => {
		expect(
			readIdempotencyKey(withKey('"8e03978e-40d5-43e8-bc93-6894a57f9324"'))
		).toBe('8e03978e-40d5-43e8-bc93-6894a57f9324')
	})

	it('unescapes the two escapes a string may carry', () => {
		expect(readIdempotencyKey(withKey('"a\\"b\\\\c"'))).toBe('a"b\\c')
	})

	it('reads a bare token, which common clients send', () => {
		expect(readIdempotencyKey(withKey('retry-1'))).toBe('retry-1')
	})

	it.each([
		['missing', undefined],
		['empty', ''],
		['an empty string', '""'],
		['an unknown escape', '"a\\nb"'],
		['an unescaped quote inside', '"a"b"'],
		['a bare value with a space', 'two words'],
		['longer than 255 characters', `"${'k'.repeat(256)}"`]
	])('refuses a key that is %s', (_label, value) => {
		expect(readIdempotencyKey(withKey(value))).toBeNull()
	})
})

describe('fingerprintRequest', () => {
	const post = (path = '/api/v1/projects', method = 'POST') =>
		new Request(`https://vectreal.com${path}`, { method })

	it('is the same for the same request, whatever the key order', () => {
		expect(fingerprintRequest(post(), { name: 'Chairs', tag: 'a' })).toBe(
			fingerprintRequest(post(), { tag: 'a', name: 'Chairs' })
		)
	})

	it('differs when a value, the path or the method differs', () => {
		const base = fingerprintRequest(post(), { name: 'Chairs' })

		expect(fingerprintRequest(post(), { name: 'Tables' })).not.toBe(base)
		expect(
			fingerprintRequest(post('/api/v1/scenes'), { name: 'Chairs' })
		).not.toBe(base)
		expect(
			fingerprintRequest(post('/api/v1/projects', 'PUT'), { name: 'Chairs' })
		).not.toBe(base)
	})
})
