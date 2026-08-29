import { useEffect, useState } from 'react'

import { useOncePerFetcherResponse } from './use-once-per-fetcher-response'

/**
 * Counts down a resend cooldown, restarting on every send the server accepts.
 *
 * The obvious spelling of this - an effect keyed on a `wasSent` boolean derived
 * from `fetcher.data?.sent` - restarts the cooldown exactly once. React Router
 * carries the previous `data` through a resubmission (`getSubmittingFetcher`
 * reuses `existingFetcher.data`), so on the second send `wasSent` is already
 * true, the dependency never changes, and the timer never restarts. The button
 * then re-enables the moment a fresh captcha token lands, a few hundred
 * milliseconds later, for every send after the first.
 *
 * `useOncePerFetcherResponse` keys on response *identity* instead, which is the
 * distinction that matters here: two successful sends carry byte-identical
 * bodies, so nothing about the content can tell them apart.
 *
 * Lives here rather than in the route because a route module cannot be
 * imported by a test - `getDbClient()` throws at module scope.
 */
export function useResendCooldown<TData extends { sent?: boolean }>(
	fetcher: { state: string; data: TData | undefined },
	seconds: number
): number {
	const [remaining, setRemaining] = useState(0)

	useOncePerFetcherResponse(fetcher, (data) => {
		if (data.sent) setRemaining(seconds)
	})

	useEffect(() => {
		if (remaining <= 0) return
		const id = setTimeout(() => setRemaining((n) => n - 1), 1000)
		return () => clearTimeout(id)
	}, [remaining])

	return remaining
}
