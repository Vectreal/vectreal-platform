import { Outlet, redirect } from 'react-router'

import { Route } from './+types/nav-layout'
import { Footer } from '../../components/footer'
import { Navigation } from '../../components/navigation'
import { createSupabaseClient } from '../../lib/supabase.server'
import { isMobileRequest } from '../../lib/utils/is-mobile-request'


export async function loader({ request }: Route.LoaderArgs) {
	/**
	 * Determine if the request comes from a mobile client by the headers in the request
	 */
	const defaultResponse = {
		isMobile: isMobileRequest(request),
		user: null
	}

	try {
		const { client, headers } = await createSupabaseClient(request)

		const {
			data: { session }
		} = await client.auth.getSession()

		if (!session) return defaultResponse

		const {
			data: { user }
		} = await client.auth.getUser()

		// Create a new URL object to parse the request URL
		const url = new URL(request.url)
		const isRootPage = url.pathname === '/'

		// If the user is authenticated and trying to access the root page, redirect to the dashboard
		// This makes the dashboard the landing page for authenticated users
		if (user && isRootPage) {
			return redirect('/dashboard', { headers })
		} else {
			return { user, isMobile: isMobileRequest(request) }
		}
	} catch (error) {
		console.error('Error during loader authentication check:', error)
	}

	return defaultResponse
}
const Layout = ({ loaderData }: Route.ComponentProps) => {
	return (
		<>
			<Navigation user={loaderData.user} />
			<Outlet />
			<Footer />
		</>
	)
}

export default Layout
