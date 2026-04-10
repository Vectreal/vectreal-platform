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

posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_TOKEN, {
	api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
	ui_host:
		import.meta.env.VITE_PUBLIC_POSTHOG_UI_HOST || 'https://eu.posthog.com',
	defaults: '2026-01-30',
	// Add tracing headers so server-side middleware can correlate events.
	__add_tracing_headers: [window.location.host, 'localhost']
	// PostHog starts opted-in by default. ConsentProvider will call
	// opt_out_capturing() for users who have explicitly rejected analytics.
})

// Expose posthog globally so ConsentProvider can call opt_in/opt_out
// without importing posthog-js directly in every component.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).posthog = posthog

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
