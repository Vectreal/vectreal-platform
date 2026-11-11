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

import {
	MODEL_INTAKE_AGENCY_PAGE_PATH,
	MODEL_INTAKE_PATH
} from '../domain/model-intake/model-intake-shared'

export interface PageChrome {
	nav: boolean
	footer: boolean
	/** Whether the page's primary action is the brand orange: the public site, not the publisher's editor. */
	brandPrimary: boolean
	/**
	 * Whether the nav's primary action is too. Not on the home page, where the
	 * hero's main action is the one orange primary in view and a second in the
	 * nav would split it.
	 */
	brandNavPrimary: boolean
	/**
	 * The letter funnel's own chrome in place of the nav and the footer: the
	 * logo, the language switch and the legal links, in the page's language.
	 * A reader who scanned a letter has one thing to do, and the site nav and
	 * its English labels compete with it.
	 */
	focused: boolean
}

const PUBLISHER_PATH = '/publisher'
const INTAKE_PATHS = new Set([MODEL_INTAKE_PATH, MODEL_INTAKE_AGENCY_PAGE_PATH])
const HOME_PATHS = new Set(['/', '/home'])

export function routePageChrome(pathname: string): PageChrome {
	if (
		pathname === PUBLISHER_PATH ||
		pathname.startsWith(`${PUBLISHER_PATH}/`)
	) {
		return {
			nav: false,
			footer: false,
			brandPrimary: false,
			brandNavPrimary: false,
			focused: false
		}
	}

	if (INTAKE_PATHS.has(pathname)) {
		return {
			nav: false,
			footer: false,
			brandPrimary: true,
			brandNavPrimary: true,
			focused: true
		}
	}

	return {
		nav: true,
		footer: true,
		brandPrimary: true,
		brandNavPrimary: !HOME_PATHS.has(pathname),
		focused: false
	}
}
