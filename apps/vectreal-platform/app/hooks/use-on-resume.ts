import { useEffect, useRef } from 'react'

interface UseOnResumeOptions {
	enabled?: boolean
	cooldownMs?: number
}

const DEFAULT_COOLDOWN_MS = 30_000

/**
 * Run `onResume` when the tab is brought back to the foreground (focus,
 * visibility change, or bfcache restore via `pageshow`), throttled by a
 * cooldown.
 *
 * Shared primitive so every "refresh when the user returns" behavior (auth
 * revalidation, current-user re-fetch) uses the same events and cadence.
 */
export function useOnResume(
	onResume: () => void,
	{ enabled = true, cooldownMs = DEFAULT_COOLDOWN_MS }: UseOnResumeOptions = {}
) {
	const lastFiredAtRef = useRef(0)
	const callbackRef = useRef(onResume)
	callbackRef.current = onResume

	useEffect(() => {
		if (!enabled) {
			return
		}

		const fire = () => {
			const now = Date.now()
			if (now - lastFiredAtRef.current < cooldownMs) {
				return
			}
			lastFiredAtRef.current = now
			callbackRef.current()
		}

		const handleVisibilityChange = () => {
			if (!document.hidden) {
				fire()
			}
		}

		document.addEventListener('visibilitychange', handleVisibilityChange)
		window.addEventListener('focus', fire)
		window.addEventListener('pageshow', fire)

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange)
			window.removeEventListener('focus', fire)
			window.removeEventListener('pageshow', fire)
		}
	}, [enabled, cooldownMs])
}
