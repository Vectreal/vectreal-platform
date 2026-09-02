import { hasAnalyticsConsent } from '../../consent/consent-cookie'

import type { PostHog } from 'posthog-node'

export type ServerAnalyticsEvent =
	| {
			name: 'user_signed_up'
			props: {
				method: 'email' | 'oauth'
				referrer?: string
				utm_source?: string
			}
	  }
	| { name: 'user_signed_in'; props: { method: 'email' | 'oauth' } }
	| { name: 'contact_form_submitted'; props: Record<string, unknown> }
	| { name: 'contact_form_submit_failed'; props: Record<string, unknown> }
	| { name: 'contact_form_blocked'; props: Record<string, unknown> }

/**
 * Send a server-side analytics event, but only with the visitor's consent.
 *
 * The client SDK is opted out until analytics consent is granted, so without
 * this gate the server would be the one path that still reported on people who
 * declined. `request` is required for exactly that reason: the consent cookie
 * travels on it, and there is no way to answer "may we send this?" without it.
 *
 * Absent or unparseable consent means no, so a visitor who never answered the
 * banner is never reported on.
 */
export function captureServerEvent(
	posthog: PostHog | undefined,
	request: Request,
	distinctId: string,
	event: ServerAnalyticsEvent
): void {
	if (!hasAnalyticsConsent(request)) return

	posthog?.capture({
		distinctId,
		event: event.name,
		properties: { client_type: 'web', ...event.props }
	})
}
