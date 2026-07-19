import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'

import { Route } from './+types/nav-layout'
import { Footer } from '../../components/footer'
import { Navigation } from '../../components/navigation'
import {
	CurrentUserProvider,
	useCurrentUser
} from '../../hooks/use-current-user'
import { identifyMobileRequest } from '../../lib/utils/identify-mobile-request'

export async function loader({ request }: Route.LoaderArgs) {
	// Public pages are CDN-cacheable, so this loader must stay free of
	// per-visitor state. Auth is hydrated on the client via CurrentUserProvider.
	// `isMobile` is only an SSR hint — useIsMobile re-detects on the client.
	return { isMobile: identifyMobileRequest(request) }
}

function NavigationWithUser({ isMobileRequest }: { isMobileRequest: boolean }) {
	const { user } = useCurrentUser()
	return <Navigation user={user} isMobileRequest={isMobileRequest} />
}

/**
 * Authenticated users landing on the marketing root are sent to the dashboard.
 * Done on the client because the root page is served from the anonymous CDN
 * cache, so a server-side redirect cannot fire reliably.
 */
function AuthedRootRedirect() {
	const { user, ready } = useCurrentUser()
	const { pathname } = useLocation()
	const navigate = useNavigate()

	useEffect(() => {
		if (ready && user && pathname === '/') {
			navigate('/dashboard', { replace: true })
		}
	}, [ready, user, pathname, navigate])

	return null
}

const Layout = ({ loaderData }: Route.ComponentProps) => (
	<CurrentUserProvider>
		<AuthedRootRedirect />
		<NavigationWithUser isMobileRequest={loaderData.isMobile} />
		<Outlet />
		<Footer />
	</CurrentUserProvider>
)

export default Layout
