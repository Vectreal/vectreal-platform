/**
 * By default, React Router will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx react-router reveal` ✨
 * For more information, see https://reactrouter.com/explanation/special-files#entryclienttsx
 */

import { PostHogProvider } from '@posthog/react'
import posthog from 'posthog-js'
import { startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { HydratedRouter } from 'react-router/dom'

if (!import.meta.env.DEV || import.meta.env.VITE_PUBLIC_POSTHOG_ENABLED === 'true') {
	posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_TOKEN, {
		api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
		ui_host:
			import.meta.env.VITE_PUBLIC_POSTHOG_UI_HOST || 'https://eu.posthog.com',
		defaults: '2026-01-30',
		// Add tracing headers so server-side middleware can correlate events.
		__add_tracing_headers: [window.location.host, 'localhost'],
		// Start in memory-only mode — no cookies or localStorage until the user
		// grants analytics consent. Basic anonymous traffic (pageviews) is still
		// captured without storing anything on the device (DSGVO-compliant).
		// ConsentProvider switches persistence to 'localStorage+cookie' once the
		// user accepts analytics.
		persistence: 'memory'
	})

	// Expose posthog globally so ConsentProvider can call opt_in/opt_out
	// without importing posthog-js directly in every component.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	;(window as any).posthog = posthog
}

startTransition(() => {
	hydrateRoot(
		document,
		<PostHogProvider client={posthog}>
			{/* <StrictMode> */}
			<HydratedRouter />
			{/* </StrictMode> */}
		</PostHogProvider>
	)
})
