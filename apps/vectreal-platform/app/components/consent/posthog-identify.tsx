import { usePostHog } from '@posthog/react'
import { useEffect } from 'react'

interface PostHogIdentifyProps {
	userId: string
	email?: string | null
	name?: string | null
}

/**
 * Identifies the authenticated user with PostHog once mounted.
 * Should be rendered inside an authenticated layout (e.g. DashboardLayout).
 */
export function PostHogIdentify({ userId, email, name }: PostHogIdentifyProps) {
	const posthog = usePostHog()

	useEffect(() => {
		if (!posthog) return
		posthog.identify(userId, {
			...(email != null && { email }),
			...(name != null && { name })
		})
	}, [posthog, userId, email, name])

	return null
}
