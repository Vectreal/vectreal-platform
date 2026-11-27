import { describe, expect, it } from 'vitest'

import {
	redactUrlSecretsFromProperties,
	redactUrlSecrets
} from './redact-url-secrets'

/**
 * A live API key must not leave the browser inside an analytics event.
 *
 * The leak this prevents was not at a capture site. PostHog attaches
 * `$current_url` to every event it sends, and on `/embed` that URL carries the
 * token, so the key rode out on every captured event - including ones nobody
 * wrote, and any added later.
 */

const EMBED_URL =
	'https://vectreal.com/embed/395a09f0-9340/488bd4a1-46d3?token=vctrl_liveSecretab3x'

describe('redactUrlSecrets', () => {
	it('replaces the token in an embed URL', () => {
		const redacted = redactUrlSecrets(EMBED_URL)

		expect(redacted).not.toContain('vctrl_liveSecretab3x')
		expect(new URL(redacted).searchParams.get('token')).toBe('redacted')
	})

	it('keeps every other part of the URL intact', () => {
		const redacted = new URL(
			redactUrlSecrets(`${EMBED_URL}&transition=linear&autoRotate=0`)
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
		expect(redactUrlSecrets('/embed/a/b?token=vctrl_liveSecretab3x')).toBe(
			'/embed/a/b?token=redacted'
		)
		expect(redactUrlSecrets('?token=vctrl_liveSecretab3x')).toBe(
			'?token=redacted'
		)
	})

	it('stops at a fragment rather than eating it', () => {
		expect(redactUrlSecrets('/e?token=vctrl_secret#camera-2')).toBe(
			'/e?token=redacted#camera-2'
		)
	})

	it('leaves the rest of the query byte-for-byte alone', () => {
		// A parse-and-reserialize version turned spaces into `+` and escaped
		// characters the URL grammar leaves literal, reporting a URL the visitor
		// never had.
		const url = `${EMBED_URL}&label=a%20b&note=it's~(fine)`

		expect(redactUrlSecrets(url)).toBe(
			url.replace('vctrl_liveSecretab3x', 'redacted')
		)
	})

	it('redacts a capitalised parameter name', () => {
		// The regex was case-insensitive while the cheap-reject guard in front of
		// it was not, so this returned unredacted before reaching the rewrite.
		expect(redactUrlSecrets('https://vectreal.com/e?Token=vctrl_secret')).toBe(
			'https://vectreal.com/e?Token=redacted'
		)
		expect(redactUrlSecrets('https://vectreal.com/e?TOKEN=vctrl_secret')).toBe(
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
			expect(redactUrlSecrets(url), `call ${attempt}`).toBe(
				'https://vectreal.com/e?token=redacted'
			)
		}
	})

	it('does not match a parameter that merely ends in token', () => {
		const url = 'https://vectreal.com/x?mytoken=vctrl_liveSecretab3x'

		expect(redactUrlSecrets(url)).toBe(url)
	})

	it('leaves a URL without a token alone', () => {
		const url = 'https://vectreal.com/pricing?utm_source=x'

		expect(redactUrlSecrets(url)).toBe(url)
	})

	it('leaves prose that merely mentions a token alone', () => {
		// The cheap `includes` pre-check matches this. The `[?&]` anchor is what
		// stops it being rewritten: there is no parameter position here.
		const message = 'Request failed: token=missing'

		expect(redactUrlSecrets(message)).toBe(message)
	})

	it('does not throw on a value that is not a URL', () => {
		expect(() => redactUrlSecrets('token=')).not.toThrow()
	})
})

/*
  Email addresses are kept out of analytics and logs entirely. They reached
  PostHog in the `/auth/confirm-pending?email=` URL, and can reach it in any
  string: an error message, a caller's property, a search query.
*/
describe('redactUrlSecrets on email addresses', () => {
	it('replaces a plain address wherever it sits in a string', () => {
		expect(redactUrlSecrets('jane.doe@example.com')).toBe('redacted')
		expect(
			redactUrlSecrets('User jane.doe+news@mail.example.co.uk already exists')
		).toBe('User redacted already exists')
	})

	it('replaces a percent-encoded address in a query string', () => {
		// `searchParams.set` writes the `@` as `%40`, the `+` as `%2B`.
		expect(
			redactUrlSecrets(
				'https://vectreal.com/auth/confirm-pending?email=jane%2Bx%40example.com&next=%2Fonboarding'
			)
		).toBe(
			'https://vectreal.com/auth/confirm-pending?email=redacted&next=%2Fonboarding'
		)
	})

	it('replaces an address with letters outside ASCII whole', () => {
		expect(redactUrlSecrets('mail jürgen.ößer@müller-bau.de now')).toBe(
			'mail redacted now'
		)
	})

	it('replaces an address whose letters outside ASCII are encoded', () => {
		const url = new URL('https://vectreal.com/x')
		url.searchParams.set('email', 'jürgen.andré@müller.de')
		url.searchParams.set('next', '/onboarding')

		expect(redactUrlSecrets(url.toString())).toBe(
			'https://vectreal.com/x?email=redacted&next=%2Fonboarding'
		)
	})

	it('replaces an address encoded twice, inside a nested URL', () => {
		// `next=/x?email=a%40b.com` serialized as a parameter value.
		expect(
			redactUrlSecrets('/sign-in?next=%2Fx%3Femail%3Djane%2540example.com')
		).toBe('/sign-in?next=%2Fx%3Femail%3Dredacted')
	})

	it('replaces an address in a path and a fragment', () => {
		expect(redactUrlSecrets('/u/jane@example.com#Jane@Example.COM')).toBe(
			'/u/redacted#redacted'
		)
	})

	it.each([
		['Write to a@example.de.', 'Write to redacted'],
		["user 'a@example.de' exists", 'user redacted exists'],
		['{a@example.de}', 'redacted'],
		['a@example.de- a@example.de~', 'redacted redacted'],
		[
			"No account for jane@example.com's workspace",
			'No account for redacted workspace'
		],
		['user:jane@example.com|org1', 'user:redacted'],
		['jane@example.com_old', 'redacted'],
		['?email=jane%40example.com%27s&n=1', '?email=redacted&n=1'],
		['jane@example.xn--p1ai', 'redacted']
	])('replaces an address with punctuation after it: %s', (value, expected) => {
		expect(redactUrlSecrets(value)).toBe(expected)
	})

	it('replaces every address, not only the first', () => {
		expect(redactUrlSecrets('a@example.com,b@example.org')).toBe(
			'redacted,redacted'
		)
	})

	it('replaces both a token and an address in one URL', () => {
		expect(
			redactUrlSecrets('/e?token=vctrl_secret&email=a%40example.com')
		).toBe('/e?token=redacted&email=redacted')
	})

	it('redacts consistently across repeated calls', () => {
		for (let attempt = 0; attempt < 5; attempt += 1) {
			expect(redactUrlSecrets('a@example.com'), `call ${attempt}`).toBe(
				'redacted'
			)
		}
	})

	it.each([
		'@vctrl/viewer',
		'three@0.181.2',
		'onClick@https://vectreal.com/assets/app.js:1:20',
		'50% off',
		'https://vectreal.com/pricing?utm_source=x'
	])('leaves %s alone', (value) => {
		expect(redactUrlSecrets(value)).toBe(value)
	})

	it.each([
		['local part', `/${'a'.repeat(50_000)}@${'b'.repeat(50_000)}`],
		['escape chain', `%${'25'.repeat(20_000)}@`],
		['escapes', `${'%25'.repeat(30_000)}40`],
		['dots', `a@${'.'.repeat(50_000)}`],
		['dots before a letter', `a@${'.'.repeat(50_000)}x`]
	])('stays fast on a hostile %s', (_name, hostile) => {
		// The request log runs this on URLs a stranger chose.
		const started = performance.now()
		redactUrlSecrets(hostile)
		expect(performance.now() - started).toBeLessThan(250)
	})

	it.each(['100%jane@example.com', '%zjane%40example.com'])(
		'replaces %s after a stray percent sign',
		(value) => {
			expect(redactUrlSecrets(value)).not.toMatch(/jane/)
		}
	)

	it('replaces an address with encoded punctuation in its local part', () => {
		expect(redactUrlSecrets('?email=j%7Edoe%21x%40example.com&n=1')).toBe(
			'?email=redacted&n=1'
		)
	})
})

describe('redactUrlSecretsFromProperties', () => {
	it('redacts the property PostHog adds to every event', () => {
		const event = redactUrlSecretsFromProperties({
			event: 'preview_viewed',
			properties: { $current_url: EMBED_URL, scene_id: 'abc' }
		})

		expect(JSON.stringify(event)).not.toContain('vctrl_liveSecretab3x')
		expect(event.properties.scene_id).toBe('abc')
	})

	it('redacts a token nested below the top level', () => {
		const event = redactUrlSecretsFromProperties({
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
		const event = redactUrlSecretsFromProperties({
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

	it('redacts a URL used as a key, as heatmaps send them', () => {
		const event = redactUrlSecretsFromProperties({
			event: '$$heatmap',
			properties: { $heatmap_data: { [EMBED_URL]: [{ x: 1 }] } }
		})

		expect(JSON.stringify(event)).not.toContain('vctrl_liveSecretab3x')
		expect(Object.values(event.properties.$heatmap_data)).toEqual([[{ x: 1 }]])
	})

	it('leaves values it does not understand as they are', () => {
		const date = new Date('2026-08-22T12:00:00.000Z')
		const event = redactUrlSecretsFromProperties({
			properties: { when: date, count: 3, ok: true, missing: null }
		})

		expect(event.properties.when).toBe(date)
		expect(event.properties.count).toBe(3)
		expect(event.properties.ok).toBe(true)
		expect(event.properties.missing).toBeNull()
	})
})
