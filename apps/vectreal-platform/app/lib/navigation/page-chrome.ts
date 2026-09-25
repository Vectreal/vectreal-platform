/**
 * Which global chrome a route wants, derived from the path alone.
 *
 * Path-derived on purpose: this runs during SSR and prerendering, where the only
 * thing known about the page is its URL. Anything client-state-derived would
 * paint one way on the server and another after hydration, which is the class of
 * bug this module exists to prevent.
 *
 * The publisher is the only route family that suppresses chrome: every path
 * under it hands the top of the viewport to `PublisherHeader` and shows no
 * footer.
 *
 * It used to keep the nav at `/publisher` itself, where an empty publisher was
 * a separate drop screen, and dropping a file swapped that screen for the
 * editor without navigating. The URL could not express the swap, so a runtime
 * channel hid the nav after paint. The empty state is a state of the editor
 * now, which is what lets the URL alone decide again.
 */

export interface PageChrome {
	nav: boolean
	footer: boolean
}

const PUBLISHER_PATH = '/publisher'

export function routePageChrome(pathname: string): PageChrome {
	if (
		pathname === PUBLISHER_PATH ||
		pathname.startsWith(`${PUBLISHER_PATH}/`)
	) {
		return { nav: false, footer: false }
	}

	return { nav: true, footer: true }
}
