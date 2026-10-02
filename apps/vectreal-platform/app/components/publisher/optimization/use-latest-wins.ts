import { useCallback, useRef } from 'react'

/**
 * Runs `run` one call at a time. Calls made while one runs collapse into the
 * newest, which runs as soon as the current one settles, so a burst of
 * requests costs at most one extra run and always ends on the last one.
 *
 * `run` is read when each run starts, so it can close over fresh state.
 */
export function useLatestWins<Input>(
	run: (input: Input) => Promise<void>
): (input: Input) => Promise<void> {
	const runRef = useRef(run)
	runRef.current = run
	const isRunningRef = useRef(false)
	// Wrapped, so an `undefined` input can still be queued.
	const queuedRef = useRef<{ input: Input } | null>(null)

	return useCallback(async (input: Input) => {
		if (isRunningRef.current) {
			queuedRef.current = { input }
			return
		}

		isRunningRef.current = true
		try {
			let next: { input: Input } | null = { input }
			while (next) {
				queuedRef.current = null
				await runRef.current(next.input)
				next = queuedRef.current
			}
		} finally {
			isRunningRef.current = false
		}
	}, [])
}
