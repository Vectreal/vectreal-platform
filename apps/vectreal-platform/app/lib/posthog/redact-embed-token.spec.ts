import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
	redactEmbedTokenFromProperties,
	redactEmbedToken
} from './redact-embed-token'

/**
 * A live API key must not leave the browser inside an analytics event.
 *
 * The leak this prevents was not at a capture site. PostHog attaches
 * `$current_url` to every event it sends, and on `/embed` that URL carries the
 * token, so the key rode out on every captured event - including ones nobody
 * wrote, and any added later.
 */

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

const EMBED_URL =
	'https://vectreal.com/embed/395a09f0-9340/488bd4a1-46d3?token=vctrl_liveSecretab3x'

describe('redactEmbedToken', () => {
	it('replaces the token in an embed URL', () => {
		const redacted = redactEmbedToken(EMBED_URL)

		expect(redacted).not.toContain('vctrl_liveSecretab3x')
		expect(new URL(redacted).searchParams.get('token')).toBe('redacted')
	})

	it('keeps every other part of the URL intact', () => {
		const redacted = new URL(
			redactEmbedToken(`${EMBED_URL}&transition=linear&autoRotate=0`)
		)

		expect(redacted.origin).toBe('https://vectreal.com')
		expect(redacted.pathname).toBe('/embed/395a09f0-9340/488bd4a1-46d3')
		expect(redacted.searchParams.get('transition')).toBe('linear')
		expect(redacted.searchParams.get('autoRotate')).toBe('0')
	})

	/*
	  PostHog's autocapture records `$elements[].attr__href` from the raw
	  `getAttribute('href')`, which is whatever the markup said - often relative.
	  A parse-based redaction skipped those entirely.
	*/
	it('redacts a relative URL, which autocapture can produce', () => {
		expect(redactEmbedToken('/embed/a/b?token=vctrl_liveSecretab3x')).toBe(
			'/embed/a/b?token=redacted'
		)
		expect(redactEmbedToken('?token=vctrl_liveSecretab3x')).toBe(
			'?token=redacted'
		)
	})

	it('stops at a fragment rather than eating it', () => {
		expect(redactEmbedToken('/e?token=vctrl_secret#camera-2')).toBe(
			'/e?token=redacted#camera-2'
		)
	})

	it('leaves the rest of the query byte-for-byte alone', () => {
		// A parse-and-reserialize version turned spaces into `+` and escaped
		// characters the URL grammar leaves literal, reporting a URL the visitor
		// never had.
		const url = `${EMBED_URL}&label=a%20b&note=it's~(fine)`

		expect(redactEmbedToken(url)).toBe(
			url.replace('vctrl_liveSecretab3x', 'redacted')
		)
	})

	it('redacts a capitalised parameter name', () => {
		// The regex was case-insensitive while the cheap-reject guard in front of
		// it was not, so this returned unredacted before reaching the rewrite.
		expect(redactEmbedToken('https://vectreal.com/e?Token=vctrl_secret')).toBe(
			'https://vectreal.com/e?Token=redacted'
		)
		expect(redactEmbedToken('https://vectreal.com/e?TOKEN=vctrl_secret')).toBe(
			'https://vectreal.com/e?TOKEN=redacted'
		)
	})

	it('redacts consistently across repeated calls', () => {
		/*
		  A global regex in the guard would advance `lastIndex` on a match and
		  report false on the next call, letting every other value through.
		*/
		const url = 'https://vectreal.com/e?token=vctrl_secret'

		for (let attempt = 0; attempt < 5; attempt += 1) {
			expect(redactEmbedToken(url), `call ${attempt}`).toBe(
				'https://vectreal.com/e?token=redacted'
			)
		}
	})

	it('does not match a parameter that merely ends in token', () => {
		const url = 'https://vectreal.com/x?mytoken=vctrl_liveSecretab3x'

		expect(redactEmbedToken(url)).toBe(url)
	})

	it('leaves a URL without a token alone', () => {
		const url = 'https://vectreal.com/pricing?utm_source=x'

		expect(redactEmbedToken(url)).toBe(url)
	})

	it('leaves prose that merely mentions a token alone', () => {
		// The cheap `includes` pre-check matches this. The `[?&]` anchor is what
		// stops it being rewritten: there is no parameter position here.
		const message = 'Request failed: token=missing'

		expect(redactEmbedToken(message)).toBe(message)
	})

	it('does not throw on a value that is not a URL', () => {
		expect(() => redactEmbedToken('token=')).not.toThrow()
	})
})

describe('redactEmbedTokenFromProperties', () => {
	it('redacts the property PostHog adds to every event', () => {
		const event = redactEmbedTokenFromProperties({
			event: 'preview_viewed',
			properties: { $current_url: EMBED_URL, scene_id: 'abc' }
		})

		expect(JSON.stringify(event)).not.toContain('vctrl_liveSecretab3x')
		expect(event.properties.scene_id).toBe('abc')
	})

	it('redacts a token nested below the top level', () => {
		const event = redactEmbedTokenFromProperties({
			properties: {
				$set: { last_seen_on: EMBED_URL },
				breadcrumbs: [{ url: EMBED_URL }]
			}
		})

		expect(JSON.stringify(event)).not.toContain('vctrl_liveSecretab3x')
	})

	it('redacts every URL-valued property, not a named list of them', () => {
		/*
		  The point of walking the object rather than picking known keys: PostHog
		  adds `$initial_current_url`, `$referrer` and others without this code
		  knowing their names, and invents more between versions.
		*/
		const event = redactEmbedTokenFromProperties({
			properties: {
				$current_url: EMBED_URL,
				$initial_current_url: EMBED_URL,
				$referrer: EMBED_URL,
				some_future_property: EMBED_URL
			}
		})

		for (const value of Object.values(event.properties)) {
			expect(value).not.toContain('vctrl_liveSecretab3x')
		}
	})

	it('leaves values it does not understand as they are', () => {
		const date = new Date('2026-08-22T12:00:00.000Z')
		const event = redactEmbedTokenFromProperties({
			properties: { when: date, count: 3, ok: true, missing: null }
		})

		expect(event.properties.when).toBe(date)
		expect(event.properties.count).toBe(3)
		expect(event.properties.ok).toBe(true)
		expect(event.properties.missing).toBeNull()
	})
})

/*
  The other half of the contract. The redaction is correct and useless unless
  PostHog is actually told to run it, and nothing else in the suite can see that
  - `entry.client.tsx` calls `posthog.init` at module scope against a real
  browser global, so importing it here is not an option.
*/
describe('posthog is wired to use it', () => {
	const entryClient = readFileSync(
		join(APP_ROOT, 'app/entry.client.tsx'),
		'utf8'
	)

	/*
	  Asserted by ordering rather than by proximity. The first version allowed
	  120 characters between the two and broke the moment a comment was added
	  between them, which is a test that fails for a reason unrelated to the
	  behaviour it guards.
	*/
	it('registers the redaction with before_send', () => {
		const hook = entryClient.indexOf('before_send')
		const call = entryClient.indexOf('redactEmbedTokenFromProperties(')

		expect(
			hook,
			'posthog.init no longer configures before_send, so nothing filters events.'
		).toBeGreaterThan(-1)

		expect(
			call,
			'redactEmbedTokenFromProperties is never called, so the embed token is captured verbatim.'
		).toBeGreaterThan(-1)

		expect(
			call,
			'redactEmbedTokenFromProperties is called outside before_send, so it does not run for every event.'
		).toBeGreaterThan(hook)
	})
})
