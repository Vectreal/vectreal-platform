import { describe, expect, it } from 'vitest'

import { UsageError } from './errors'
import { DEFAULT_ORIGIN, normalizeOrigin, resolveOrigin } from './origin'

describe('resolveOrigin', () => {
	it('takes the flag, then the environment, then the last login, then vectreal.com', () => {
		const all = {
			flag: 'https://flag.example',
			env: 'https://env.example',
			saved: 'https://saved.example'
		}
		expect(resolveOrigin(all)).toBe('https://flag.example')
		expect(resolveOrigin({ ...all, flag: undefined })).toBe(
			'https://env.example'
		)
		expect(resolveOrigin({ saved: all.saved })).toBe('https://saved.example')
		expect(resolveOrigin({})).toBe(DEFAULT_ORIGIN)
	})
})

describe('normalizeOrigin', () => {
	it('keeps the origin and drops any path', () => {
		expect(normalizeOrigin('https://vectreal.com/dashboard')).toBe(
			'https://vectreal.com'
		)
	})

	it('allows plain http on loopback only', () => {
		expect(normalizeOrigin('http://localhost:4200')).toBe(
			'http://localhost:4200'
		)
		expect(normalizeOrigin('http://127.0.0.1:4200')).toBe(
			'http://127.0.0.1:4200'
		)
		expect(() => normalizeOrigin('http://vectreal.com')).toThrow(UsageError)
		expect(() => normalizeOrigin('ftp://localhost')).toThrow(UsageError)
		expect(() => normalizeOrigin('vectreal.com')).toThrow(UsageError)
	})
})
