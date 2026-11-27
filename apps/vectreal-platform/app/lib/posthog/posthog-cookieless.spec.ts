// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	CONSENT_COOKIE_NAME,
	CONSENT_POLICY_VERSION,
	encodeConsentCookieValue
} from '../consent/consent-cookie'

import type { CaptureResult, PostHog } from 'posthog-js'

/*
  A fresh instance per test: the default export is a page-wide singleton
  that refuses a second init.
*/
const instance = vi.hoisted(() => ({ current: undefined as unknown }))
vi.mock('posthog-js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('posthog-js')>()
	return {
		...actual,
		get default() {
			return instance.current
		}
	}
})

/*
  The real posthog-js with the app's own configuration: what a visitor who
  has not accepted analytics keeps on their device and what leaves it is
  decided by the library and our config together, and a mock of either half
  would only test the other.
*/

async function start(): Promise<{ posthog: PostHog; sent: CaptureResult[] }> {
	const { PostHog } = await import('posthog-js')
	instance.current = new PostHog()
	const { loadPostHog } = await import('./posthog-browser')
	const posthog = await loadPostHog('/news-room/an-article')
	if (!posthog) throw new Error('PostHog did not start')
	const sent: CaptureResult[] = []
	// Emitted after `before_send`, with what would be sent.
	posthog.on('eventCaptured', (event: CaptureResult) => sent.push(event))
	return { posthog, sent }
}

function grantAnalytics() {
	document.cookie = `${CONSENT_COOKIE_NAME}=${encodeConsentCookieValue({
		version: CONSENT_POLICY_VERSION,
		choices: {
			necessary: true,
			functional: false,
			analytics: true,
			marketing: false
		}
	})}`
}

/** Cookie names other than the visitor's own consent record. */
function cookieNames(): string[] {
	return document.cookie
		.split(';')
		.map((entry) => entry.split('=')[0].trim())
		.filter((name) => name && name !== CONSENT_COOKIE_NAME)
}

/*
  One spy for the whole file: posthog-js keeps the `fetch` it found when it
  first loaded, so a spy swapped in per test would watch nothing.
*/
const transport = vi.fn(async () => new Response('{}', { status: 200 }))
vi.stubGlobal('fetch', transport)

/** The paths PostHog has asked for so far in this test. */
function requested(): string[] {
	return transport.mock.calls.map(
		(call: unknown[]) => new URL(String(call[0])).pathname
	)
}

function clearCookies() {
	for (const name of document.cookie.split(';')) {
		document.cookie = `${name.split('=')[0].trim()}=; max-age=0; path=/`
	}
}

beforeEach(() => {
	vi.stubEnv('VITE_PUBLIC_POSTHOG_ENABLED', 'true')
	vi.stubEnv('VITE_PUBLIC_POSTHOG_TOKEN', 'phc_test')
	vi.stubEnv('VITE_PUBLIC_POSTHOG_HOST', 'https://posthog.invalid')
	transport.mockClear()
})

afterEach(() => {
	vi.unstubAllEnvs()
	clearCookies()
	localStorage.clear()
	sessionStorage.clear()
})

describe('PostHog without analytics consent', () => {
	it('keeps nothing on the device', async () => {
		const { posthog } = await start()
		posthog.capture('$pageview')
		posthog.capture('newsroom_article_viewed', { slug: 'an-article' })

		expect(cookieNames()).toEqual([])
		expect(localStorage.length).toBe(0)
		expect(sessionStorage.length).toBe(0)
	})

	it('sends only the allowlisted events, flagged for the server hash', async () => {
		const { posthog, sent } = await start()
		posthog.capture('$pageview')
		posthog.capture('converter_model_received', { file_format: 'fbx' })
		posthog.capture('newsroom_article_viewed', { slug: 'an-article' })

		expect(sent.map((event) => event.event)).toEqual([
			'$pageview',
			'newsroom_article_viewed'
		])
		for (const event of sent) {
			expect(event.properties.$cookieless_mode).toBe(true)
			expect(event.properties.distinct_id).toBe('$posthog_cookieless')
		}
	})

	it('sends the page without its query string or device details', async () => {
		const { posthog, sent } = await start()
		posthog.capture('$pageview', {
			$current_url:
				'https://vectreal.com/auth/confirm-pending?email=someone%40example.com&utm_source=newsletter'
		})

		const [pageview] = sent
		expect(JSON.stringify(pageview)).not.toContain('example.com')
		expect(pageview.properties).toMatchObject({
			$current_url: 'https://vectreal.com/auth/confirm-pending',
			utm_source: 'newsletter',
			token: 'phc_test'
		})
		expect(pageview.properties).not.toHaveProperty('$screen_width')
		expect(pageview.properties).not.toHaveProperty('$viewport_width')
		expect(pageview.properties).not.toHaveProperty('$timezone')
		expect(pageview.properties).not.toHaveProperty('client_type')
		expect(pageview).not.toHaveProperty('$set')
		expect(pageview).not.toHaveProperty('$set_once')
	})

	/*
	  `/flags` skips `before_send` and carries the first page's full address,
	  query included, plus the organization a signed-in visitor belongs to.
	*/
	it('never asks for feature flags', async () => {
		window.history.pushState({}, '', '/auth/confirm-pending?email=a%40b.c')
		const { posthog } = await start()
		posthog.capture('$pageview')
		posthog.group('organization', 'org-1', { plan: 'free' })
		posthog.reloadFeatureFlags()

		// Long enough for a granted visitor's request: see the test below.
		await new Promise((resolve) => setTimeout(resolve, 500))
		expect(requested()).not.toContain('/flags/')
		window.history.pushState({}, '', '/')
	})

	// Written by the release before this one on every rejection.
	it('removes a refusal an earlier release stored', async () => {
		localStorage.setItem('__ph_opt_in_out_phc_test', '0')

		await start()

		expect(localStorage.length).toBe(0)
	})
})

describe('PostHog with analytics consent', () => {
	it('captures in full and persists its identity', async () => {
		grantAnalytics()
		const { posthog, sent } = await start()
		posthog.capture('converter_model_received', { file_format: 'fbx' })
		posthog.reloadFeatureFlags()

		expect(sent.map((event) => event.event)).toContain(
			'converter_model_received'
		)
		const event = sent.find((e) => e.event === 'converter_model_received')
		expect(event?.properties.$cookieless_mode).toBeUndefined()
		expect(event?.properties.client_type).toBe('web')
		expect(cookieNames().some((name) => name.startsWith('ph_'))).toBe(true)
		await vi.waitFor(() => expect(requested()).toContain('/flags/'))
	})

	it('leaves nothing behind when the grant is withdrawn', async () => {
		grantAnalytics()
		const { posthog, sent } = await start()
		const { applyAnalyticsConsent } = await import('./analytics-consent')

		applyAnalyticsConsent(posthog, false)
		posthog.capture('converter_model_received', { file_format: 'fbx' })
		posthog.capture('$pageview')

		expect(cookieNames()).toEqual([])
		expect(localStorage.length).toBe(0)
		expect(sent.map((event) => event.event)).toEqual(['$pageview'])
		expect(sent[0].properties.$cookieless_mode).toBe(true)
	})
})
