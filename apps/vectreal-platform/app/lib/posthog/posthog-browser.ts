import { readConsentCookie } from '../consent/consent-cookie'
import { isThirdPartySurface } from '../third-party-surface'
import { applyAnalyticsConsent } from './analytics-consent'
import { DEAD_CLICKS_CONFIG, RAGECLICK_CONFIG } from './frustration-signals'
import { isPosthogEnabled } from './posthog-enabled'

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

		/*
		  What decides each event's fate only runs once the library does, so
		  it arrives with it rather than on every page's first load.
		*/
		const [{ default: posthog }, { createBeforeSend }] = await Promise.all([
			import('posthog-js'),
			import('./before-send')
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
			  `before_send` (`before-send.ts`, `cookieless-events.ts`). Without the opt-out
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
			// Redaction, the cookieless allowlist and exception tags: see the module.
			before_send: createBeforeSend(window.location.hostname)
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
