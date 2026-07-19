import { data, Outlet } from 'react-router'

import { Route } from './+types/nav-layout'
import { Footer } from '../../components/footer'
import { Navigation } from '../../components/navigation'
import {
	CurrentUserProvider,
	useCurrentUser
} from '../../hooks/use-current-user'
import {
	isAnonymousCacheableRequest,
	publicCacheHeaders
} from '../../lib/http/cacheable-public-paths.server'
import { identifyMobileRequest } from '../../lib/utils/identify-mobile-request'

export async function loader({ request }: Route.LoaderArgs) {
	// Public pages are CDN-cacheable, so this loader must stay free of
	// per-visitor state. Auth is hydrated on the client via CurrentUserProvider.
	// `isMobile` is only an SSR hint; useIsMobile re-detects on the client.
	const loaderData = { isMobile: identifyMobileRequest(request) }

	// Mirror the document cache policy on the loader (.data) response so
	// client-side navigations to public pages stay edge-cacheable too. The
	// headers export below propagates these onto the single-fetch response.
	return isAnonymousCacheableRequest(request)
		? data(loaderData, { headers: publicCacheHeaders() })
		: data(loaderData)
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
	return loaderHeaders
}

function NavigationWithUser({ isMobileRequest }: { isMobileRequest: boolean }) {
	const { user } = useCurrentUser()
	return <Navigation user={user} isMobileRequest={isMobileRequest} />
}

const Layout = ({ loaderData }: Route.ComponentProps) => (
	<CurrentUserProvider>
		<NavigationWithUser isMobileRequest={loaderData.isMobile} />
		<Outlet />
		<Footer />
	</CurrentUserProvider>
)

export default Layout
