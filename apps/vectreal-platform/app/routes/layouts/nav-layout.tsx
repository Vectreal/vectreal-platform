import { Outlet } from 'react-router'

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
	// `isMobile` is only an SSR hint; useIsMobile re-detects on the client.
	// The `.data` cache policy is applied centrally in entry.server's
	// handleDataRequest via the same predicate used for documents.
	return { isMobile: identifyMobileRequest(request) }
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
