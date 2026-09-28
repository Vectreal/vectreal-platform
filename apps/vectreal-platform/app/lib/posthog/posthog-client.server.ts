import { PostHog } from 'posthog-node'

import { isPosthogEnabled } from './posthog-enabled'

/**
 * The process-wide `posthog-node` client, and the only one.
 *
 * Extracted from `posthog-middleware.ts` when the server error sink became a
 * second caller. Two clients would mean two batching queues, two flush
 * intervals and two shutdown hooks over one project - and an exception captured
 * on a client nobody shuts down is an exception that never leaves the machine.
 *
 * Returns `null` when PostHog is switched off for this build (see
 * `isPosthogEnabled`) or not configured. Every caller has to handle that, and
 * none of them may treat it as an error: analytics being off is not a reason
 * for a request to fail.
 */

let sharedPosthogClient: null | PostHog = null
let shutdownHookRegistered = false

export function getPosthogClient(): null | PostHog {
	const enabled = isPosthogEnabled({
		// Optional: the tsx maintenance scripts reach this with no Vite, where
		// `import.meta.env` does not exist, and a throw here would abort them
		// from inside the catch block that was reporting their error.
		dev: import.meta.env?.DEV === true,
		flag: process.env.VITE_PUBLIC_POSTHOG_ENABLED
	})
	if (!enabled) {
		return null
	}

	const token = process.env.VITE_PUBLIC_POSTHOG_TOKEN
	const host = process.env.VITE_PUBLIC_POSTHOG_HOST

	if (!token || !host) {
		return null
	}

	if (!sharedPosthogClient) {
		sharedPosthogClient = new PostHog(token, {
			host,
			// Batch events and flush on interval to keep requests non-blocking.
			flushAt: 20,
			flushInterval: 10_000
		})
	}

	if (!shutdownHookRegistered) {
		shutdownHookRegistered = true
		process.once('beforeExit', () => {
			sharedPosthogClient?.shutdown().catch(() => {})
		})
	}

	return sharedPosthogClient
}

/**
 * The distinct id the browser is reporting under, if it told us.
 *
 * `posthog-js` injects this header on same-origin requests
 * (`__add_tracing_headers` in `entry.client.tsx`). Passing it through ties a
 * server-side exception to the session that provoked it, which is the
 * difference between "something 500'd" and "this is what the user was doing".
 */
export function distinctIdFromRequest(request: Request): string | undefined {
	return request.headers.get('X-POSTHOG-DISTINCT-ID') ?? undefined
}
