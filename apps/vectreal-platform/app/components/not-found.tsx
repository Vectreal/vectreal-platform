import { Button } from '@shared/components/ui/button'
import { Link, useLocation } from 'react-router'

import { PageHero } from './layout-components'
import { buildMeta } from '../lib/seo'

/**
 * What a visitor sees at an address nothing lives at.
 *
 * Rendered by the site-wide `*` route, and by the root fallback when a loader
 * throws a 404 that no nearer boundary catches. The requested path is echoed
 * back because it is the one specific thing this page knows, and a mistyped
 * address is easiest to spot when it is shown.
 */
export function NotFound() {
	const { pathname } = useLocation()

	return (
		<main>
			<PageHero
				heading="This page does not exist"
				description={
					<>
						Nothing lives at{' '}
						<code className="text-foreground break-all">{pathname}</code>. The
						link may be out of date, or the address mistyped.
					</>
				}
				actions={
					<>
						<Button asChild>
							<Link to="/" viewTransition>
								Go to the home page
							</Link>
						</Button>
						<Button asChild variant="ghost">
							<Link to="/docs" viewTransition>
								Read the docs
							</Link>
						</Button>
					</>
				}
			/>
		</main>
	)
}

/** Kept out of search results, and with no canonical pointing anywhere. */
export function notFoundMeta() {
	return buildMeta([{ title: 'Page not found - Vectreal' }], undefined, {
		private: true
	})
}
