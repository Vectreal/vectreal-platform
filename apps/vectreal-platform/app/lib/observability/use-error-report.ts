import { usePostHog } from '@posthog/react'
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

import { buildErrorReport } from './error-report'

/**
 * The one path by which a rendered error leaves the browser.
 *
 * Every error boundary in the app calls this and nothing else calls
 * `captureException`. That is the whole point of the module:
 * `tests/error-boundary-reporting.spec.ts` enumerates the files that declare an
 * `ErrorBoundary` and fails unless each one resolves to a component that
 * imports this hook, so a boundary added tomorrow cannot quietly swallow what
 * it catches. Before this existed there was exactly one `captureException` in
 * the product, in root's `ErrorBoundary`, and React never rendered it: React
 * Router composes the root error element as `<Layout><ErrorBoundary/></Layout>`
 * and root's `Layout` returns its own fallback without rendering `children`
 * whenever `useRouteError()` is set.
 *
 * Safe to call unconditionally with no error - boundaries are components, so
 * the call cannot be moved inside an `if`. `undefined` reports nothing.
 *
 * Two things it deliberately does not do:
 *
 *   - It does not report during SSR. `usePostHog()` has no provider on the
 *     server and effects do not run there; server-side errors are the server
 *     sink's job, and it sees strictly more of them than this could.
 *   - It does not opt anyone in. `posthog-js` is initialised opted out and
 *     stays that way until analytics consent is granted, so a visitor who has
 *     not accepted reports nothing from the browser. That is the consent
 *     promise working as written, and it is the reason the server sink is not
 *     optional.
 */
export function useErrorReport(error: unknown): void {
	const posthog = usePostHog()
	/*
	  The router's location, not `window.location`. They agree in a browser -
	  React Router pushes history before it renders - but only one of them is the
	  router's own state, and reading the global made the flow attribution depend
	  on a side effect of navigation rather than on the route that failed.
	*/
	const { pathname } = useLocation()
	/*
	  Guards the report, not the render, and has two jobs. StrictMode
	  double-invokes mount effects, and it is commented out in `entry.client.tsx`
	  rather than removed - so without this, turning it back on would double
	  every exception in the feed, with the cause nowhere near the switch that
	  caused it. And `pathname` is a dependency below, so a location change while
	  one error is still on screen must not re-send it.
	*/
	const reported = useRef<unknown>(undefined)

	useEffect(() => {
		if (error === undefined || error === null) return
		if (reported.current === error) return

		const report = buildErrorReport(error, {
			source: 'client-boundary',
			pathname
		})
		if (!report) return

		reported.current = error
		posthog?.captureException(report.error, report.properties)
	}, [error, pathname, posthog])
}
