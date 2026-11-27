import { describe, expect, it } from 'vitest'

import { toCookielessEvent } from './cookieless-events'

import type { CaptureResult } from 'posthog-js'

const event = (
	name: string,
	properties: Record<string, unknown>,
	extra: Partial<CaptureResult> = {}
) =>
	({
		uuid: 'u1',
		event: name,
		timestamp: new Date(0),
		properties: { token: 'phc_test', $cookieless_mode: true, ...properties },
		...extra
	}) as CaptureResult

describe('toCookielessEvent', () => {
	it.each(['$autocapture', '$exception', '$set', 'converter_model_received'])(
		'drops an event not on the allowlist (%s)',
		(name) => {
			expect(toCookielessEvent(event(name, {}))).toBeNull()
		}
	)

	it("keeps an event's own allowlisted properties and nothing else it passed", () => {
		const sent = toCookielessEvent(
			event('newsroom_cta_clicked', {
				slug: 'a',
				destination: 'publisher',
				action: 'primary',
				email: 'someone@example.com'
			})
		)

		expect(sent?.properties).toMatchObject({
			slug: 'a',
			destination: 'publisher',
			action: 'primary'
		})
		expect(sent?.properties).not.toHaveProperty('email')
	})

	it('sends the page address without its query, and its campaign apart', () => {
		const sent = toCookielessEvent(
			event('$pageview', {
				$current_url:
					'https://vectreal.com/auth/confirm-pending?email=a%40b.c&utm_source=news&utm_medium=mail#top'
			})
		)

		expect(sent?.properties).toMatchObject({
			$current_url: 'https://vectreal.com/auth/confirm-pending',
			utm_source: 'news',
			utm_medium: 'mail'
		})
		expect(JSON.stringify(sent)).not.toContain('a%40b.c')
	})

	it('sends the referring site, never the page on it', () => {
		const from = (referrer: string) =>
			toCookielessEvent(event('$pageview', { $referrer: referrer }))?.properties
				.$referrer

		expect(from('https://www.google.com/search?q=private')).toBe(
			'https://www.google.com'
		)
		expect(from('$direct')).toBe('$direct')
	})

	it('drops device details, person properties and the fields PostHog does not need', () => {
		const sent = toCookielessEvent(
			event(
				'$pageview',
				{
					$screen_width: 1440,
					$viewport_height: 900,
					$timezone: 'Europe/Berlin',
					$browser_language: 'de-DE',
					title: 'Page',
					$raw_user_agent: 'UA',
					$host: 'vectreal.com',
					distinct_id: '$posthog_cookieless'
				},
				{ $set: { email: 'x' }, $set_once: { $initial_pathname: '/' } }
			)
		)

		expect(Object.keys(sent?.properties ?? {}).sort()).toEqual(
			[
				'$cookieless_mode',
				'$current_url',
				'$host',
				'$raw_user_agent',
				'$referrer',
				'distinct_id',
				'token'
			].sort()
		)
		expect(sent).not.toHaveProperty('$set')
		expect(sent).not.toHaveProperty('$set_once')
	})
})
