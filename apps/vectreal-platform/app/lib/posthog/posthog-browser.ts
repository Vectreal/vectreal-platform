import { readConsentCookie } from '../consent/consent-cookie'
import { isThirdPartySurface } from '../third-party-surface'
import { DEAD_CLICKS_CONFIG, RAGECLICK_CONFIG } from './frustration-signals'
import { isPosthogEnabled } from './posthog-enabled'
import { redactUrlSecretsFromProperties } from './redact-url-secrets'

import type { PostHog } from 'posthog-js'

/**
 * The browser's PostHog client, or `undefined` where there is none.
 *
 * The only module that loads `posthog-js`, and it loads it with `import()`,
 * so the library (about 75 KB) downloads only on a page that starts it. A
 * static import anywhere put it on every page, `/embed` included, where it
 * never starts: see `third-party-surface.ts`. The decision and the import
 * live together so no call site can load the library on its own, and
 * `posthog-browser.spec.ts` fails if one does.
 *
 * Started from `entry.client.tsx` before hydration and not awaited there:
 * hydration never waits for analytics. Components read the client through
 * `usePostHog()` (`posthog-react.tsx`), which is `undefined` until this
 * resolves, so anything they capture on mount runs from an effect keyed on
 * the client.
 *
 * Never rejects. `posthog.init` and `set_config` touch localStorage and
 * cookies, which Safari throws on when site data is blocked, in Lockdown Mode
 * and in some private windows; a failed chunk download rejects the import.
 * Either way the page goes on without analytics. The catch logs because there
 * is nowhere else to report it: the error sink is PostHog, which is what just
 * failed.
 */
export async function loadPostHog(
	pathname: string
): Promise<PostHog | undefined> {
	if (
		isThirdPartySurface(pathname) ||
		!isPosthogEnabled({
			dev: import.meta.env.DEV,
			flag: import.meta.env.VITE_PUBLIC_POSTHOG_ENABLED
		})
	) {
		return undefined
	}

	try {
		/*
		  Read now, before hydration, as it was when init ran synchronously: the
		  calls queued while the library downloads are judged against the consent
		  in force when they were made. A choice made meanwhile reaches PostHog
		  through ConsentProvider's own queued calls, in order.
		*/
		const consented = readConsentCookie()?.choices.analytics

		const { default: posthog } = await import('posthog-js')

		posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_TOKEN, {
			api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
			ui_host:
				import.meta.env.VITE_PUBLIC_POSTHOG_UI_HOST || 'https://eu.posthog.com',
			defaults: '2026-01-30',
			// Add tracing headers so server-side middleware can correlate events.
			__add_tracing_headers: [window.location.host, 'localhost'],
			// Nothing is sent to PostHog until the user grants analytics consent.
			// posthog-js defaults `opt_out_capturing_by_default` to false, which would
			// leave capturing live from init: on a first visit ConsentProvider has no
			// decision to apply yet, so it never calls opt_out_capturing() and events
			// would flow before the banner is answered. Opting out here is what makes
			// the "only after you opt in" promise in the privacy policy true.
			opt_out_capturing_by_default: true,
			// Memory-only until consent, so nothing is written to the device either.
			// ConsentProvider switches persistence to 'localStorage+cookie' and calls
			// opt_in_capturing() once the user accepts analytics.
			persistence: 'memory',
			capture_pageview: false,
			// A drag on a 3D viewer is not a frustrated click: see the module.
			rageclick: RAGECLICK_CONFIG,
			capture_dead_clicks: DEAD_CLICKS_CONFIG,
			/*
			  An embed authenticates by a `token` query parameter, so an embed URL
			  contains a live API key - and PostHog attaches URLs (`$current_url`,
			  `$referrer`) to every event, not just `$pageview`. PostHog never
			  starts on `/embed` itself; this still keeps a key from leaving in any
			  URL an event carries from the rest of the site.

			  Here rather than at a capture site: this runs for every event, including
			  the properties PostHog adds itself, so there is no list of call sites to
			  keep in step and no way for a new event to miss it.
			*/
			before_send: (event) => {
				if (!event) return event

				/*
				  Session replay is excluded, and not because it is safe. A `$snapshot`
				  carries a whole rrweb payload, and walking one on every snapshot
				  would cost far more than the rest of this does on a normal event.
				  So the one page whose URL holds a key is never recorded at all:
				  PostHog does not start on `/embed` (see the condition above).
				  Everywhere else replay follows the project's remote config.
				*/
				if (event.event === '$snapshot') return event

				return redactUrlSecretsFromProperties(event)
			}
		})
		posthog.register({ client_type: 'web' })

		/*
		  Stored consent is applied before the client is handed to React, so
		  the first `$pageview` (captured once the client arrives) already
		  goes out for a returning consenter. Only ever opts IN: with no
		  cookie, or analytics declined, the opt-out above stands.
		  ConsentProvider stays responsible for reacting to changes.
		*/
		if (consented) {
			posthog.set_config({ persistence: 'localStorage+cookie' })
			posthog.opt_in_capturing()
		}

		return posthog
	} catch (error) {
		console.error('Analytics setup failed; continuing without it.', error)
		return undefined
	}
}
