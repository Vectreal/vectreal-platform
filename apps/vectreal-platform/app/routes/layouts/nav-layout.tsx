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
			{/*
			  The nav and the page each take their own `--primary` scope, because
			  on the home page only the page's is the brand. The page's wrappers
			  are `contents`, so they add a scope without adding a box: nothing
			  below lays out against them.
			*/}
			<DocsTocProvider>
				<div
					data-material="object"
					data-site="marketing"
					className={cn(
						!chrome.nav && 'hidden',
						chrome.brandNavPrimary && 'primary-brand'
					)}
				>
					<Navigation />
				</div>
				{/* The publisher is nested here too, and its editor keeps the plate rims. */}
				<div
					data-material={chrome.brandPrimary ? 'object' : undefined}
					data-site={chrome.brandPrimary ? 'marketing' : undefined}
					className={cn('contents', chrome.brandPrimary && 'primary-brand')}
				>
					<Outlet />
				</div>
			</DocsTocProvider>
			{chrome.footer && (
				<div
					data-material="object"
					data-site="marketing"
					className={cn('contents', chrome.brandPrimary && 'primary-brand')}
				>
					<Footer />
				</div>
			)}
		</CurrentUserProvider>
	)
}

export default Layout
