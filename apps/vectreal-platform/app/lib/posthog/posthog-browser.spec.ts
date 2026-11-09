// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEAD_CLICKS_CONFIG, RAGECLICK_CONFIG } from './frustration-signals'
import {
	isDynamicImport,
	sourceFiles,
	valueReferences
} from '../../../tests/module-references'
import {
	CONSENT_COOKIE_NAME,
	CONSENT_POLICY_VERSION,
	encodeConsentCookieValue
} from '../consent/consent-cookie'

/**
 * posthog-js is about 75 KB, and a page that never starts PostHog must not
 * download it. `/embed` runs on merchants' pages, where analytics code has no
 * business being at all.
 */

const APP_ROOT = resolve(import.meta.dirname, '../../..')
const LOADER = join(import.meta.dirname, 'posthog-browser.ts')

const { evaluated, client } = vi.hoisted(() => ({
	evaluated: vi.fn(),
	client: {
		init: vi.fn(),
		register: vi.fn(),
		set_config: vi.fn(),
		opt_in_capturing: vi.fn()
	}
}))

// The factory runs when the module is first imported, so `evaluated` says
// whether the library was downloaded at all.
vi.mock('posthog-js', () => {
	evaluated()
	return { default: client }
})

async function load(pathname: string) {
	vi.resetModules()
	const { loadPostHog } = await import('./posthog-browser')
	return loadPostHog(pathname)
}

beforeEach(() => {
	vi.clearAllMocks()
	vi.stubEnv('VITE_PUBLIC_POSTHOG_ENABLED', 'true')
	vi.stubEnv('VITE_PUBLIC_POSTHOG_TOKEN', 'phc_test')
})

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllEnvs()
	document.cookie = `${CONSENT_COOKIE_NAME}=; max-age=0`
})

describe('loadPostHog', () => {
	it.each(['/embed/p1/s1', '/embed', '/EMBED/a/b'])(
		'never downloads the library on a customer page (%s)',
		async (pathname) => {
			expect(await load(pathname)).toBeUndefined()
			expect(evaluated).not.toHaveBeenCalled()
			expect(client.init).not.toHaveBeenCalled()
		}
	)

	it('never downloads the library with the switch off', async () => {
		vi.stubEnv('VITE_PUBLIC_POSTHOG_ENABLED', 'false')
		expect(await load('/')).toBeUndefined()
		expect(evaluated).not.toHaveBeenCalled()
	})

	it.each(['/', '/preview/p1/s1', '/publisher'])(
		'starts PostHog opted out on a first-party page (%s)',
		async (pathname) => {
			expect(await load(pathname)).toBe(client)
			expect(client.init).toHaveBeenCalledTimes(1)
			expect(client.init.mock.calls[0][1]).toMatchObject({
				opt_out_capturing_by_default: true,
				persistence: 'memory',
				capture_pageview: false,
				// A drag on a 3D viewer is not a frustrated click.
				rageclick: RAGECLICK_CONFIG,
				capture_dead_clicks: DEAD_CLICKS_CONFIG
			})
			expect(client.opt_in_capturing).not.toHaveBeenCalled()
		}
	)

	/*
	  An embed URL carries a live API key, and PostHog attaches URLs to every
	  event it sends, its own included. The redaction runs on all of them.
	*/
	it('redacts URL secrets from every event before it is sent', async () => {
		await load('/')
		const { before_send } = client.init.mock.calls[0][1]

		const sent = before_send({
			event: '$autocapture',
			properties: {
				$current_url: 'https://vectreal.com/embed/p/s?token=vctrl_liveSecret'
			}
		})

		expect(JSON.stringify(sent)).not.toContain('vctrl_liveSecret')
	})

	// Before the client reaches React, so the first `$pageview` is not dropped.
	it('applies stored analytics consent before handing the client over', async () => {
		document.cookie = `${CONSENT_COOKIE_NAME}=${encodeConsentCookieValue({
			version: CONSENT_POLICY_VERSION,
			choices: {
				necessary: true,
				functional: false,
				analytics: true,
				marketing: false
			}
		})}`

		expect(await load('/')).toBe(client)
		expect(client.set_config).toHaveBeenCalledWith({
			persistence: 'localStorage+cookie'
		})
		expect(client.opt_in_capturing).toHaveBeenCalledTimes(1)
	})

	/*
	  As when init ran before hydration: a choice made while the library
	  downloads reaches it through ConsentProvider, in order, not by
	  re-reading the cookie and opting in calls queued before it.
	*/
	it('reads stored consent when loading starts, not when the library lands', async () => {
		vi.resetModules()
		const { loadPostHog } = await import('./posthog-browser')
		const loading = loadPostHog('/')
		document.cookie = `${CONSENT_COOKIE_NAME}=${encodeConsentCookieValue({
			version: CONSENT_POLICY_VERSION,
			choices: {
				necessary: true,
				functional: false,
				analytics: true,
				marketing: false
			}
		})}`

		expect(await loading).toBe(client)
		expect(client.opt_in_capturing).not.toHaveBeenCalled()
	})

	// A sandboxed frame without allow-same-origin throws on document.cookie.
	it('resolves without a client when reading consent throws', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {})
		const cookie = vi
			.spyOn(document, 'cookie', 'get')
			.mockImplementation(() => {
				throw new DOMException('sandboxed', 'SecurityError')
			})

		await expect(load('/')).resolves.toBeUndefined()
		expect(cookie).toHaveBeenCalled()
		expect(error).toHaveBeenCalled()
	})

	// Safari throws on storage when site data is blocked. Hydration must not care.
	it('resolves without a client when init throws', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {})
		client.init.mockImplementationOnce(() => {
			throw new Error('SecurityError')
		})

		expect(await load('/')).toBeUndefined()
		expect(error).toHaveBeenCalled()
	})
})

describe('the library', () => {
	const files = sourceFiles(join(APP_ROOT, 'app')).map((file) => ({
		file,
		source: readFileSync(file, 'utf8')
	}))
	const show = (file: string) => relative(APP_ROOT, file)

	// A static import anywhere puts it in the entry's first load, on every page.
	it('is loaded by no module but the browser loader', () => {
		expect(
			files
				.filter(
					({ file, source }) =>
						file !== LOADER &&
						source.includes('posthog-js') &&
						valueReferences(file, source, 'posthog-js').length > 0
				)
				.map(({ file }) => show(file))
		).toEqual([])
	})

	it('is loaded by the browser loader only through import()', () => {
		const source = readFileSync(LOADER, 'utf8')
		const references = valueReferences(LOADER, source, 'posthog-js')
		expect(references.length).toBeGreaterThan(0)
		expect(references.every(isDynamicImport)).toBe(true)
	})

	// It imports posthog-js statically for its default context value.
	it('is not reached through @posthog/react', () => {
		expect(
			files
				.filter(
					({ file, source }) =>
						source.includes('@posthog/react') &&
						valueReferences(file, source, '@posthog/react').length > 0
				)
				.map(({ file }) => show(file))
		).toEqual([])
	})
})
