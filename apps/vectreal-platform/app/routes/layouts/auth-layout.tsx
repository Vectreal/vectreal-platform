import { Outlet, redirect } from 'react-router'

import { createClient } from '../../lib/supabase.server'

import { Route } from './+types/auth-layout'

export const loader = async ({ request }: Route.ActionArgs) => {
	const { client, headers } = await createClient(request)

	const {
		error,
		data: { user }
	} = await client.auth.getUser()

	if (error || !user) return redirect('/sign-up', { headers })

	return { user }
}

const AuthLayout = () => {
	return <Outlet />
}

export default AuthLayout
