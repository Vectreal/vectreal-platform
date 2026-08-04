import { usePostHog } from '@posthog/react'
import { useEffect } from 'react'

import { useConsent } from './consent-context'

interface PostHogIdentifyProps {
	userId: string
	email?: string | null
	name?: string | null
}

/**
 * Identifies the authenticated user with PostHog once mounted.
 * Should be rendered inside an authenticated layout (e.g. DashboardLayout).
 *
 * Gated on analytics consent. `identify` attaches the user id, email and name to
 * the PostHog profile, so calling it before consent would send PII regardless of
 * the opt-out that suppresses ordinary events. Being signed in is not consent to
 * analytics, so this stays inert until the user accepts.
 */
export function PostHogIdentify({ userId, email, name }: PostHogIdentifyProps) {
	const posthog = usePostHog()
	const { consent } = useConsent()
	const hasAnalyticsConsent = consent?.analytics === true

	useEffect(() => {
		if (!posthog) return
		if (!hasAnalyticsConsent) return
		posthog.identify(userId, {
			...(email != null && { email }),
			...(name != null && { name })
		})
	}, [posthog, hasAnalyticsConsent, userId, email, name])

	return null
}
