import { Outlet, useLocation } from 'react-router'

import { Navigation } from '../../components'
import { createClient } from '../../lib/supabase.server'

import { Route } from './+types/nav-layout'

export const loader = async ({ request }: Route.LoaderArgs) => {
	const { client } = await createClient(request)
	const {
		data: { user }
	} = await client.auth.getUser()
	return { user }
}

const Layout = ({ loaderData }: Route.ComponentProps) => {
	const { pathname } = useLocation()
	return (
		<>
			<Navigation user={loaderData.user} pathname={pathname} />
			<Outlet />
		</>
	)
}

export default Layout
