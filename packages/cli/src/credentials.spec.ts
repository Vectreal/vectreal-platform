import { existsSync, mkdtempSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import {
	configDir,
	fallbackStore,
	fileStore,
	loadSession,
	saveSession,
	type SecretStore
} from './credentials'
import { memoryStore } from './test-support'

const session = {
	clientId: 'c',
	authorizationServer: 'http://127.0.0.1:1/auth/v1',
	accessToken: 'a',
	refreshToken: 'r',
	expiresAt: 1
}

describe('fileStore', () => {
	it('reads a torn file as empty and writes a whole one over it', () => {
		const dir = mkdtempSync(join(tmpdir(), 'vectreal-cli-'))
		writeFileSync(join(dir, 'credentials.json'), '{"https://vectreal.com": "{')
		const store = fileStore(dir)

		expect(loadSession(store, 'https://vectreal.com')).toBeNull()
		saveSession(store, 'https://vectreal.com', session)
		expect(loadSession(store, 'https://vectreal.com')).toEqual(session)
	})

	it('writes nothing when deleting a session it does not hold', () => {
		const dir = join(mkdtempSync(join(tmpdir(), 'vectreal-cli-')), 'vectreal')
		fileStore(dir).delete('https://vectreal.com')
		expect(existsSync(dir)).toBe(false)
	})

	it('keeps sessions per origin in a file only the user can read', () => {
		const dir = join(mkdtempSync(join(tmpdir(), 'vectreal-cli-')), 'vectreal')
		const store = fileStore(dir)

		saveSession(store, 'https://vectreal.com', session)
		saveSession(store, 'http://localhost:4200', {
			...session,
			accessToken: 'local'
		})

		expect(loadSession(store, 'https://vectreal.com')?.accessToken).toBe('a')
		expect(loadSession(store, 'http://localhost:4200')?.accessToken).toBe(
			'local'
		)
		expect(statSync(join(dir, 'credentials.json')).mode & 0o777).toBe(0o600)
		expect(statSync(dir).mode & 0o777).toBe(0o700)

		store.delete('https://vectreal.com')
		expect(loadSession(store, 'https://vectreal.com')).toBeNull()
		expect(loadSession(store, 'http://localhost:4200')).not.toBeNull()
	})
})

describe('fallbackStore', () => {
	it('moves to the file the first time the keychain throws, and says so once', () => {
		const broken: SecretStore = {
			get: () => {
				throw new Error('no secret service')
			},
			set: () => {
				throw new Error('no secret service')
			},
			delete: () => {
				throw new Error('no secret service')
			}
		}
		const file = memoryStore()
		const warn = vi.fn()
		const store = fallbackStore(broken, file, warn)

		saveSession(store, 'o', session)
		expect(loadSession(store, 'o')).toEqual(session)
		expect(file.entries.has('o')).toBe(true)
		expect(warn).toHaveBeenCalledOnce()
		expect(warn.mock.calls[0][0]).toContain('no secret service')
	})

	it('stays on the keychain while it works', () => {
		const keychain = memoryStore()
		const file = memoryStore()
		const store = fallbackStore(keychain, file, vi.fn())

		saveSession(store, 'o', session)
		expect(keychain.entries.has('o')).toBe(true)
		expect(file.entries.size).toBe(0)
	})

	it('finds a session the file holds while the keychain works, and deletes it from both', () => {
		// Saved over SSH with no keychain; read back from the desktop.
		const keychain = memoryStore()
		const file = memoryStore()
		saveSession(file, 'o', session)
		keychain.set('o', JSON.stringify({ ...session, accessToken: 'k' }))
		const store = fallbackStore(keychain, file, vi.fn())

		expect(loadSession(store, 'o')?.accessToken).toBe('k')
		keychain.delete('o')
		expect(loadSession(store, 'o')).toEqual(session)

		keychain.set('o', 'x')
		store.delete('o')
		expect(keychain.entries.size).toBe(0)
		expect(file.entries.size).toBe(0)
	})

	it('drops the keychain copy when a save there fails, so reads find the newer file copy', () => {
		// Reads work, writes throw: a credential grown past the platform's limit.
		const keychain = memoryStore()
		const writeRefusing: SecretStore = {
			...keychain,
			set: () => {
				throw new Error('credential too large')
			}
		}
		const file = memoryStore()
		keychain.set('o', JSON.stringify(session))
		saveSession(fallbackStore(writeRefusing, file, vi.fn()), 'o', {
			...session,
			refreshToken: 'rotated'
		})

		// The next process starts on the keychain again.
		const next = fallbackStore(writeRefusing, file, vi.fn())
		expect(loadSession(next, 'o')?.refreshToken).toBe('rotated')
	})

	it('moves a session to the keychain when it saves there, leaving no spent copy in the file', () => {
		const keychain = memoryStore()
		const file = memoryStore()
		saveSession(file, 'o', session)
		const store = fallbackStore(keychain, file, vi.fn())

		saveSession(store, 'o', { ...session, refreshToken: 'rotated' })

		expect(loadSession(keychain, 'o')?.refreshToken).toBe('rotated')
		expect(file.entries.has('o')).toBe(false)
	})
})

describe('loadSession', () => {
	it('treats an unreadable entry as signed out', () => {
		const store = memoryStore()
		store.set('o', 'not json')
		expect(loadSession(store, 'o')).toBeNull()
		store.set('o', JSON.stringify({ accessToken: 'only this' }))
		expect(loadSession(store, 'o')).toBeNull()
	})
})

describe('configDir', () => {
	it('honors XDG_CONFIG_HOME', () => {
		expect(configDir({ XDG_CONFIG_HOME: '/x' })).toBe('/x/vectreal')
	})
})
