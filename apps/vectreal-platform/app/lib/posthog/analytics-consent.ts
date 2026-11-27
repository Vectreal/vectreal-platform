import type { PostHog } from 'posthog-js'

/**
 * Brings PostHog in line with the visitor's analytics choice. The
 * `consent_prefs` cookie is the one record of that choice; PostHog keeps a
 * copy of its own, and this is the only code that writes to it.
 *
 * PostHog runs with `cookieless_mode: 'on_reject'` and opted out by default
 * (`posthog-browser.ts`), so a visitor without a grant is counted without
 * cookies and nothing is stored on their device. Three things follow:
 *
 * - Declining is not reported to PostHog. `opt_out_capturing()` writes the
 *   refusal into PostHog's storage, which would put something on the device
 *   of exactly the visitor who said no. A visitor who never opted in is
 *   already where a refusal would put them, and a refusal an earlier release
 *   stored is removed.
 * - Withdrawing a grant is reported. It ends the identified session,
 *   deletes what PostHog stored and switches to counting without cookies;
 *   clearing the stored choice afterwards removes the refusal that opting
 *   out just wrote, and leaves PostHog opted out by default.
 * - Feature flags are not asked for without a grant. The `/flags` request
 *   bypasses `before_send` and carries the first page's full address, query
 *   string included, plus the organization and timezone. The one flag the
 *   browser reads (`billing-checkout`) can only close checkout, so leaving it
 *   undefined leaves the server's answer standing.
 *
 * Also called when PostHog starts, so a grant PostHog still remembers
 * after the visitor's own cookie was cleared or says no is withdrawn too.
 */
export function applyAnalyticsConsent(posthog: PostHog, granted: boolean) {
	if (granted) {
		const flagsWereOff = posthog.config.advanced_disable_flags === true
		posthog.set_config({
			persistence: 'localStorage+cookie',
			advanced_disable_flags: false
		})
		posthog.opt_in_capturing()
		if (flagsWereOff) posthog.reloadFeatureFlags()
		return
	}

	posthog.set_config({ advanced_disable_flags: true })

	if (posthog.has_opted_in_capturing()) {
		posthog.set_config({ persistence: 'memory' })
		posthog.opt_out_capturing()
	}

	posthog.clear_opt_in_out_capturing()
}
