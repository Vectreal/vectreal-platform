import { usePostHog } from '@posthog/react'
import { useCallback } from 'react'

import { useConsent } from '../components/consent/consent-context'

/**
 * `posthog.capture`, sent only once the visitor has accepted analytics.
 *
 * The check every capture site repeats by hand, written once so the opt-out
 * path has one place to be tested rather than one per event.
 */
export function useConsentedCapture() {
	const posthog = usePostHog()
	const { consent } = useConsent()
	const analytics = Boolean(consent?.analytics)

	return useCallback(
		(event: string, properties: Record<string, unknown>) => {
			if (!analytics) return
			posthog?.capture(event, properties)
		},
		[analytics, posthog]
	)
}
