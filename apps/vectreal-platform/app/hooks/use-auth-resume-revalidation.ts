import { useRevalidator } from 'react-router'

import { useOnResume } from './use-on-resume'

interface UseAuthResumeRevalidationOptions {
	enabled?: boolean
	cooldownMs?: number
}

/**
 * Revalidate route loaders when the user returns to the tab, so server-loaded
 * auth state (dashboard, publisher) stays fresh after the session may have been
 * refreshed or signed out elsewhere.
 */
export function useAuthResumeRevalidation({
	enabled = true,
	cooldownMs
}: UseAuthResumeRevalidationOptions = {}) {
	const revalidator = useRevalidator()

	useOnResume(
		() => {
			if (revalidator.state === 'idle') {
				revalidator.revalidate()
			}
		},
		{ enabled, cooldownMs }
	)
}
