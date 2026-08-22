import { useEffect, useRef } from 'react'

/**
 * Runs `handle` exactly once for each response a fetcher settles with.
 *
 * A settled fetcher's `data` outlives the render that produced it, and an effect
 * watching it re-runs whenever anything else in its dependency list changes -
 * `useRevalidator()`'s return value cycles identity on every revalidation, which
 * is enough on its own. So something has to distinguish "this response again"
 * from "a new response".
 *
 * It has to be identity, not content. Keying on `JSON.stringify(data)` reads as
 * equivalent and is not: it silently drops any response whose body repeats. On
 * the API keys route that swallowed a second revoke (same success payload), a
 * second failure on a different key (`revokeApiKey` and `rotateApiKey` throw
 * byte-identical "not found" messages), and every CSRF failure after the first
 * (a fixed body carrying nothing that varies) - each one leaving the user with
 * no toast and no sign the action had failed. Two of those were patched by
 * making the payloads differ before the mechanism itself was recognized as the
 * cause.
 *
 * A fresh response is always a fresh object and a re-render never is, so
 * comparing the reference asks the question that was actually being asked.
 */
export function useOncePerFetcherResponse<TData>(
	fetcher: { state: string; data: TData | undefined },
	handle: (data: TData) => void
): void {
	const lastHandled = useRef<TData | undefined>(undefined)

	/*
	  The handler is held in a ref so callers can pass an inline closure without
	  it re-triggering the effect. Only the response identity may do that.
	*/
	const handleRef = useRef(handle)
	handleRef.current = handle

	useEffect(() => {
		if (fetcher.state !== 'idle' || fetcher.data === undefined) {
			return
		}

		if (lastHandled.current === fetcher.data) {
			return
		}

		lastHandled.current = fetcher.data
		handleRef.current(fetcher.data)
	}, [fetcher.state, fetcher.data])
}
