/**
 * Which global chrome a route wants, derived from the path alone.
 *
 * Path-derived on purpose: this runs during SSR and prerendering, where the only
 * thing known about the page is its URL. Anything client-state-derived would
 * paint one way on the server and another after hydration, which is the class of
 * bug this module exists to prevent.
 *
 * The publisher is the only route family that suppresses chrome. It never shows
 * the footer, and it hands the top of the viewport to `PublisherHeader` as soon
 * as there is a scene to frame. With no scene id there is nothing to frame yet,
 * so the marketing nav stands in.
 *
 * `/publisher` with a model loaded but no scene id is the one case the URL cannot
 * express — that transition happens without navigating. It is handled at runtime
 * by `useHideGlobalNav`, which may only ever hide.
 */

export interface PageChrome {
	nav: boolean
	footer: boolean
}

const PUBLISHER_PATH = '/publisher'

export function routePageChrome(pathname: string): PageChrome {
	if (pathname === PUBLISHER_PATH || pathname === `${PUBLISHER_PATH}/`) {
		return { nav: true, footer: false }
	}

	if (pathname.startsWith(`${PUBLISHER_PATH}/`)) {
		return { nav: false, footer: false }
	}

	return { nav: true, footer: true }
}
