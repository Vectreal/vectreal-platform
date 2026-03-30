import { useCallback, useEffect, useRef } from 'react'
import { useRevalidator } from 'react-router'

interface UseAuthResumeRevalidationOptions {
	enabled?: boolean
	cooldownMs?: number
}

const DEFAULT_COOLDOWN_MS = 30_000

export function useAuthResumeRevalidation({
	enabled = true,
	cooldownMs = DEFAULT_COOLDOWN_MS
}: UseAuthResumeRevalidationOptions = {}) {
	const revalidator = useRevalidator()
	const lastRevalidationAtRef = useRef(0)

	const triggerRevalidation = useCallback(() => {
		if (!enabled || revalidator.state !== 'idle') {
			return
		}

		const now = Date.now()
		if (now - lastRevalidationAtRef.current < cooldownMs) {
			return
		}

		lastRevalidationAtRef.current = now
		revalidator.revalidate()
	}, [cooldownMs, enabled, revalidator])

	useEffect(() => {
		if (!enabled) {
			return
		}

		const handleVisibilityChange = () => {
			if (document.hidden) {
				return
			}

			triggerRevalidation()
		}

		const handleFocus = () => {
			triggerRevalidation()
		}

		const handlePageShow = () => {
			triggerRevalidation()
		}

		document.addEventListener('visibilitychange', handleVisibilityChange)
		window.addEventListener('focus', handleFocus)
		window.addEventListener('pageshow', handlePageShow)

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange)
			window.removeEventListener('focus', handleFocus)
			window.removeEventListener('pageshow', handlePageShow)
		}
	}, [enabled, triggerRevalidation])
}
