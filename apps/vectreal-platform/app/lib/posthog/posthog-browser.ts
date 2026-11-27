import { readConsentCookie } from '../consent/consent-cookie'
import {
	deploymentProperties,
	environmentFromHostname,
	sendsExceptions
} from '../observability/deployment'
import { isThirdPartySurface } from '../third-party-surface'
import { applyAnalyticsConsent } from './analytics-consent'
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
		const environment = environmentFromHostname(window.location.hostname)

		/*
		  The cookieless allowlist is only read once the library runs, so it
		  arrives with it rather than on every page's first load.
		*/
		const [{ default: posthog }, { toCookielessEvent }] = await Promise.all([
			import('posthog-js'),
			import('./cookieless-events')
		])

		posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_TOKEN, {
			api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
			ui_host:
				import.meta.env.VITE_PUBLIC_POSTHOG_UI_HOST || 'https://eu.posthog.com',
			defaults: '2026-01-30',
			// Add tracing headers so server-side middleware can correlate events.
			__add_tracing_headers: [window.location.host, 'localhost'],
			/*
			  Until the visitor accepts analytics, PostHog counts without
			  cookies. `opt_out_capturing_by_default` makes "not answered yet"
			  the same as "declined", and `cookieless_mode: 'on_reject'` counts
			  both: nothing is stored on the device, no session or replay runs,
			  and PostHog derives the visitor id on its servers from a daily
			  salted hash. Which events go out, and with what, is decided in
			  `before_send` below (`cookieless-events.ts`). Without the opt-out
			  default, posthog-js would capture fully from init on a first visit,
			  before the banner is answered.

			  Accepting switches persistence to 'localStorage+cookie' and opts in
			  (`analytics-consent.ts`). Cookieless events also need the project
			  setting "cookieless server hash mode", or PostHog drops them.
			*/
			cookieless_mode: 'on_reject',
			opt_out_capturing_by_default: true,
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
			  URL an event carries from the rest of the site. The same rule keeps
			  every email address out of every event (`redact-url-secrets.ts`).

			  Here rather than at a capture site: this runs for every event, including
			  the properties PostHog adds itself, so there is no list of call sites to
			  keep in step and no way for a new event to miss it.
			*/
			before_send: (event) => {
				if (!event) return event

				/*
				  Every exception, whether `useErrorReport` sent it or PostHog
				  caught it on its own, says which deployment it came from, and
				  a development machine sends none (`deployment.ts`). Here
				  rather than in the hook because this is the one place both
				  pass through.
				*/
				const isException = event.event === '$exception'
				if (isException && !sendsExceptions(environment)) return null

				/*
				  Without consent only the allowlist leaves, already cut down.
				  Redacted all the same: an email address is kept out of every
				  event, and the path and campaign values the allowlist keeps
				  are still strings someone else chose.
				*/
				if (event.properties.$cookieless_mode === true) {
					const cookieless = toCookielessEvent(event)
					return cookieless && redactUrlSecretsFromProperties(cookieless)
				}

				/*
				  Session replay is excluded, and not because it is safe. A `$snapshot`
				  carries a whole rrweb payload, and walking one on every snapshot
				  would cost far more than the rest of this does on a normal event.
				  So the one page whose URL holds a key is never recorded at all:
				  PostHog does not start on `/embed` (see the condition above).
				  Everywhere else replay follows the project's remote config.
				*/
				if (event.event === '$snapshot') return event

				/*
				  Added here rather than with `register()`: opting in or out
				  of cookieless counting resets PostHog, and a reset drops
				  registered properties.
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
		})

		/*
		  Stored consent is applied before the client is handed to React, so
		  the first `$pageview` (captured once the client arrives) already
		  goes out in full for a returning consenter. Without a grant this
		  also withdraws one PostHog still remembers from an earlier visit.
		  ConsentProvider stays responsible for reacting to changes.
		*/
		applyAnalyticsConsent(posthog, consented === true)

		return posthog
	} catch (error) {
		console.error('Analytics setup failed; continuing without it.', error)
		return undefined
	}
}
