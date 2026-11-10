/**
 * By default, React Router will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx react-router reveal` ✨
 * For more information, see https://reactrouter.com/explanation/special-files#entryclienttsx
 */

import { startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { HydratedRouter } from 'react-router/dom'

import { loadPostHog } from './lib/posthog/posthog-browser'
import { PostHogProvider } from './lib/posthog/posthog-react'

/*
  Analytics may fail. The app may not.

  `loadPostHog` decides whether this page gets analytics at all (never on a
  customer's page: see `third-party-surface.ts`), downloads the library only
  when it does, and resolves `undefined` rather than throwing. It starts here,
  before hydration, so the download overlaps it, and hydration never waits
  for it.

  An uncaught throw above `hydrateRoot` would not degrade analytics: it would
  leave the page as server HTML with no client at all, every menu, sheet and
  3D viewer inert, and the dashboard's action triggers `disabled` so a tap on
  a card's menu falls through to the card's link. `loadPostHog` is async, so
  nothing it does can throw here.
*/
const posthog = loadPostHog(window.location.pathname)

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
