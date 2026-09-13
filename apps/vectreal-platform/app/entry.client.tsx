/**
 * By default, React Router will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx react-router reveal` ✨
 * For more information, see https://reactrouter.com/explanation/special-files#entryclienttsx
 */

import { PostHogProvider } from '@posthog/react'
import posthog from 'posthog-js'
import { startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { HydratedRouter } from 'react-router/dom'

import { readConsentCookie } from './lib/consent/consent-cookie'
import { redactEmbedTokenFromProperties } from './lib/posthog/redact-embed-token'

/*
  Analytics may fail. The app may not.

  Everything below runs at module scope, on the only path to `hydrateRoot`,
  and it reaches for APIs a browser is allowed to refuse: `posthog.init` and
  `set_config({ persistence: 'localStorage+cookie' })` both touch
  localStorage and cookies, which Safari throws on when site data is
  blocked, in Lockdown Mode, and in some private windows. An uncaught throw
  here does not degrade analytics. It stops `hydrateRoot` from ever being
  called, and the page is left as server HTML with no client at all.

  That failure is close to invisible from outside, because everything
  needing no JavaScript keeps working. Links and breadcrumbs navigate;
  every menu, sheet, tab and 3D viewer is inert; and because
  `useIsClientMounted` never flips, the dashboard's action triggers stay
  `disabled`, which `Button` renders as `pointer-events: none` - so a tap
  aimed at a card's menu passes through to the card underneath and
  navigates somewhere nobody asked to go.

  Reproduced by throwing one error above `hydrateRoot` and reading the DOM:
  the menu button reports `disabled: true, pointer-events: none`, and
  `elementFromPoint` at its centre returns the card's link.

  Isolated rather than reordered. Running before hydration is deliberate -
  see the consent note inside - so the fix is that a subsystem nobody needs
  cannot abort the one thing everybody needs. The catch logs and moves on:
  there is nowhere else to report it, since the error sink is PostHog,
  which is what just failed.
*/
try {
	if (
		!import.meta.env.DEV ||
		import.meta.env.VITE_PUBLIC_POSTHOG_ENABLED === 'true'
	) {
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
			/*
			  An embed authenticates by a `token` query parameter, so on `/embed` the
			  page URL contains a live API key - and PostHog attaches `$current_url`
			  to every event, not just `$pageview`. Without this, each captured event
			  from an embed carried the key out to a third party.

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
				  Redacting inside a replay is a different problem with a different
				  tool - PostHog's own masking - so it is filed rather than half-done
				  here. Replay is remote-config controlled and not enabled in this
				  file, so whether it is on at all has to be checked in the project.
				*/
				if (event.event === '$snapshot') return event

				return redactEmbedTokenFromProperties(event)
			}
		})
		posthog.register({ client_type: 'web' })

		// Apply stored consent synchronously, before hydration.
		//
		// ConsentProvider also applies consent, but from an effect, and PageViewTracker
		// is a sibling that mounts ahead of it in root.tsx - so its first `$pageview`
		// would fire while still opted out and be dropped. That would cost returning
		// consenters the landing pageview of every full page load. The cookie is
		// readable right here, so there is no reason to wait for React.
		//
		// Only ever opts IN: with no cookie, or analytics declined, the opt-out above
		// stands. ConsentProvider stays responsible for reacting to changes.
		if (readConsentCookie()?.choices.analytics) {
			posthog.set_config({ persistence: 'localStorage+cookie' })
			posthog.opt_in_capturing()
		}

		// Expose posthog globally so ConsentProvider can call opt_in/opt_out
		// without importing posthog-js directly in every component.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		;(window as any).posthog = posthog
	}
} catch (error) {
	console.error('Analytics setup failed; continuing without it.', error)
}

startTransition(() => {
	hydrateRoot(
		document,
		<PostHogProvider client={posthog}>
			{/* <StrictMode> */}
			<HydratedRouter />
			{/* </StrictMode> */}
		</PostHogProvider>
	)
})
