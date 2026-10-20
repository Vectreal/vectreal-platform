import { beforeEach, describe, expect, it, vi } from 'vitest'

import { keychainStore } from './credentials'

const secrets = vi.hoisted(() => new Map<string, number[]>())

vi.mock('@napi-rs/keyring', () => ({
	Entry: class {
		constructor(
			private service: string,
			private account: string
		) {}
		private get key() {
			return `${this.service}/${this.account}`
		}
		setSecret(bytes: Uint8Array) {
			secrets.set(this.key, [...bytes])
		}
		getSecret() {
			return secrets.get(this.key) ?? null
		}
		deletePassword() {
			return secrets.delete(this.key)
		}
		setPassword() {
			throw new Error('stored as UTF-16 under a 2560-byte cap on Windows')
		}
		getPassword() {
			throw new Error('stored as UTF-16 under a 2560-byte cap on Windows')
		}
	}
}))

beforeEach(() => secrets.clear())

describe('keychainStore', () => {
	it('keeps the session as its UTF-8 bytes, per origin', () => {
		const store = keychainStore('test-service')
		const session = JSON.stringify({ accessToken: 'ä'.repeat(3), n: 1 })

		store.set('https://vectreal.com', session)

		expect(secrets.get('test-service/https://vectreal.com')).toEqual([
			...new TextEncoder().encode(session)
		])
		expect(store.get('https://vectreal.com')).toBe(session)
		expect(store.get('http://localhost:4200')).toBeNull()

		store.delete('https://vectreal.com')
		expect(store.get('https://vectreal.com')).toBeNull()
	})
})
