import { Outlet } from 'react-router'

import { Navigation } from '../../components'
import { createSupabaseClient } from '../../lib/supabase.server'

import { Route } from './+types/nav-layout'

export const loader = async ({ request }: Route.LoaderArgs) => {
	const { client } = await createSupabaseClient(request)
	const {
		data: { user }
	} = await client.auth.getUser()

	return { user }
}

const Layout = ({ loaderData }: Route.ComponentProps) => {
	return (
		<>
			<Navigation user={loaderData.user} />
			<Outlet />
		</>
	)
}

export default Layout
