import { cn } from '@shared/utils'
import { Outlet, useLocation } from 'react-router'

import { DocsTocProvider } from '../../components/docs/docs-toc-context'
import { Footer } from '../../components/footer'
import { Navigation } from '../../components/navigation'
import { SiteStructuredData } from '../../components/site-structured-data'
import { CurrentUserProvider } from '../../hooks/use-current-user'
import { routePageChrome } from '../../lib/navigation/page-chrome'

/**
 * Owns the site chrome for every route that has any, the publisher included.
 *
 * The publisher used to sit in its own top-level branch and mount a second
 * `Navigation` of its own, so entering it tore down this layout and rebuilt the
 * nav from scratch — visibly, because the logo replays a fade on mount. Nesting
 * it here keeps one nav element alive across the navigation.
 *
 * The nav is hidden with a class rather than unmounted for the same reason: a
 * round trip through the publisher should not cost a remount.
 *
 * It also carries the site's structured data, because "every route with site
 * chrome" is the same set as "the public site": everything under here is what a
 * crawler should see, and the branches outside it - embed, dashboard, preview -
 * are application surface. Rendering it from the root layout instead would put
 * Vectreal's own pricing copy inside every customer's embed iframe, where it is
 * `noindex` and reaches nobody.
 */
const Layout = () => {
	const { pathname } = useLocation()
	const chrome = routePageChrome(pathname)

	return (
		<CurrentUserProvider>
			<SiteStructuredData />
			<DocsTocProvider>
				<div className={cn(!chrome.nav && 'hidden')}>
					<Navigation />
				</div>
				<Outlet />
			</DocsTocProvider>
			{chrome.footer && <Footer />}
		</CurrentUserProvider>
	)
}

export default Layout
