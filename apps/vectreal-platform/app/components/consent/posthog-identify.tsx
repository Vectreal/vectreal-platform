import { useEffect } from 'react'

import { usePostHog } from '../../lib/posthog/posthog-react'
import { redactUrlSecrets } from '../../lib/posthog/redact-url-secrets'
import { useConsent } from './consent-context'

interface PostHogIdentifyProps {
	userId: string
	name?: string | null
}

/**
 * Identifies the authenticated user with PostHog once mounted.
 * Should be rendered inside an authenticated layout (e.g. DashboardLayout).
 *
 * Gated on analytics consent. `identify` attaches the user id and name to the
 * PostHog profile, so calling it before consent would send PII regardless of
 * the opt-out that suppresses ordinary events. Being signed in is not consent to
 * analytics, so this stays inert until the user accepts.
 *
 * No email address, with consent or without: Vectreal keeps addresses out of
 * analytics entirely. `before_send` would strip one anyway
 * (`redact-url-secrets.ts`); not passing it keeps the profile honest about
 * what it holds.
 */
export function PostHogIdentify({ userId, name }: PostHogIdentifyProps) {
	const posthog = usePostHog()
	const { consent } = useConsent()
	const hasAnalyticsConsent = consent?.analytics === true

	useEffect(() => {
		if (!posthog) return
		if (!hasAnalyticsConsent) return
		/*
		  An account without a display name shows its email address as the
		  name, so `name` can be the address itself. Sending it would only
		  overwrite the profile's name with "redacted" in `before_send`.
		*/
		const sendableName =
			name != null && redactUrlSecrets(name) === name ? name : undefined
		posthog.identify(userId, sendableName ? { name: sendableName } : undefined)
	}, [posthog, hasAnalyticsConsent, userId, name])

	return null
}
