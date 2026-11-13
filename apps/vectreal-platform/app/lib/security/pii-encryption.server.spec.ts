import { describe, expect, it, vi } from 'vitest'

import {
	decryptSensitiveValue,
	encryptSensitiveValue
} from './pii-encryption.server'

/*
  A configured key, as every deployed environment has. Unset, the module
  falls back to its development key and says so, which is not what this
  file is about.
*/
vi.stubEnv('CONTACT_DATA_ENCRYPTION_KEY', 'pii-encryption-spec-key')

describe('decryptSensitiveValue', () => {
	it('reads back what encryptSensitiveValue wrote', () => {
		const link = 'https://cad.example.com/share/lamp?x=ü'
		expect(decryptSensitiveValue(encryptSensitiveValue(link))).toBe(link)
	})

	it('refuses a value whose ciphertext was changed', () => {
		const parts = encryptSensitiveValue('https://a.example.com').split(':')
		const bytes = Buffer.from(parts[4], 'base64')
		bytes[0] ^= 1
		parts[4] = bytes.toString('base64')
		expect(() => decryptSensitiveValue(parts.join(':'))).toThrow()
	})

	it('refuses a truncated tag', () => {
		const parts = encryptSensitiveValue('https://a.example.com').split(':')
		parts[3] = Buffer.from(parts[3], 'base64').subarray(0, 4).toString('base64')
		expect(() => decryptSensitiveValue(parts.join(':'))).toThrow()
	})

	it('refuses plain text', () => {
		expect(() => decryptSensitiveValue('https://a.example.com')).toThrow()
	})
})
