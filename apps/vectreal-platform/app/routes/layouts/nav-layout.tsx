import { data, Outlet, redirect } from 'react-router'

import { Route } from './+types/nav-layout'
import { Footer } from '../../components/footer'
import { Navigation } from '../../components/navigation'
import { useAuthResumeRevalidation } from '../../hooks/use-auth-resume-revalidation'
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

		if (!session) {
			return data(defaultResponse, { headers })
		}

		const {
			data: { user },
			error: userError
		} = await client.auth.getUser()

		// Stale refresh token – clear the cookie so the browser doesn't keep
		// sending it, then fall through as unauthenticated (no error log needed).
		if (userError?.code === 'refresh_token_not_found') {
			try {
				await client.auth.signOut({ scope: 'local' })
			} catch {
				// Ignore cleanup errors
			}
			return data(defaultResponse, { headers })
		}

		// Create a new URL object to parse the request URL
		const url = new URL(request.url)
		const isRootPage = url.pathname === '/'

		// If the user is authenticated and trying to access the root page, redirect to the dashboard
		// This makes the dashboard the landing page for authenticated users
		if (user && isRootPage) {
			return redirect('/dashboard', { headers })
		} else {
			return data({ user, isMobile: isMobileRequest(request) }, { headers })
		}
	} catch (error) {
		console.error('Error during loader authentication check:', error)
	}

	return data(defaultResponse)
}
const Layout = ({ loaderData }: Route.ComponentProps) => {
	useAuthResumeRevalidation({ enabled: Boolean(loaderData.user) })

	return (
		<>
			<Navigation user={loaderData.user} isMobile={loaderData.isMobile} />
			<Outlet />
			<Footer />
		</>
	)
}

export default Layout
