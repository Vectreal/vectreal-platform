import {
	deploymentProperties,
	environmentFromHostname,
	sendsExceptions
} from '../observability/deployment'
import { toCookielessEvent } from './cookieless-events'
import { redactUrlSecretsFromProperties } from './redact-url-secrets'

import type { CaptureResult } from 'posthog-js'

/**
 * posthog-js's `before_send` hook: the last look at every event before it
 * leaves the browser.
 *
 * Imported with `posthog-js` itself (`posthog-browser.ts`) rather than with
 * the entry, since it only ever runs once the library has arrived: every
 * page's first load, `/embed` included, would otherwise carry it for nothing
 * (`check-route-js-budget.ts`).
 *
 * An embed authenticates by a `token` query parameter, so an embed URL
 * contains a live API key - and PostHog attaches URLs (`$current_url`,
 * `$referrer`) to every event, not just `$pageview`. PostHog never starts on
 * `/embed` itself; this still keeps a key from leaving in any URL an event
 * carries from the rest of the site. The same rule keeps every email address
 * out of every event (`redact-url-secrets.ts`).
 *
 * Here rather than at a capture site: this runs for every event, including
 * the properties PostHog adds itself, so there is no list of call sites to
 * keep in step and no way for a new event to miss it.
 */
export function createBeforeSend(hostname: string) {
	const environment = environmentFromHostname(hostname)

	return (event: CaptureResult | null): CaptureResult | null => {
		if (!event) return event

		/*
		  Every exception, whether `useErrorReport` sent it or PostHog caught
		  it on its own, says which deployment it came from, and a development
		  machine sends none (`deployment.ts`). Here rather than in the hook
		  because this is the one place both pass through.
		*/
		const isException = event.event === '$exception'
		if (isException && !sendsExceptions(environment)) return null

		/*
		  Without consent only the allowlist leaves, already cut down.
		  Redacted all the same: an email address is kept out of every event,
		  and the path and campaign values the allowlist keeps are still
		  strings someone else chose.
		*/
		if (event.properties.$cookieless_mode === true) {
			const cookieless = toCookielessEvent(event)
			return cookieless && redactUrlSecretsFromProperties(cookieless)
		}

		/*
		  Session replay is excluded, and not because it is safe. A `$snapshot`
		  carries a whole rrweb payload, and walking one on every snapshot
		  would cost far more than the rest of this does on a normal event. So
		  the one page whose URL holds a key is never recorded at all: PostHog
		  does not start on `/embed` (`posthog-browser.ts`). Everywhere else
		  replay follows the project's remote config.
		*/
		if (event.event === '$snapshot') return event

		/*
		  Added here rather than with `register()`: opting in or out of
		  cookieless counting resets PostHog, and a reset drops registered
		  properties.
		*/
		return redactUrlSecretsFromProperties({
			...event,
			properties: {
				...event.properties,
				client_type: 'web',
				...(isException ? deploymentProperties(environment) : {})
			}
		})
	}
}
