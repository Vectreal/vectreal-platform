import { useIsAtTop } from '@vctrl-ui/hooks/use-is-at-top'
import { useEffect, useState } from 'react'
import { data, Outlet } from 'react-router'

import { Navigation } from '../../components/navigation'

import { createClient } from '../../lib/supabase.server'

import { Route } from './+types/nav-layout'

export const loader = async ({ request }: Route.LoaderArgs) => {
	const location = new URL(request.url)
	const pathname = location.pathname

	const { client, headers } = await createClient(request)

	const {
		data: { user }
	} = await client.auth.getUser()

	return data({ pathname, user }, { headers })
}

const NavLayout = ({ loaderData }: Route.ComponentProps) => {
	const { pathname, user } = loaderData
	const isHomePage = pathname === '/' || pathname === '/home'
	const isSignupPage = pathname === '/sign-up' || pathname === '/sign-in'

	const [windowHeight, setWindowHeight] = useState(0)
	const { isAtTop, ref: atTopTracker } = useIsAtTop(windowHeight)

	useEffect(() => {
		function handleResize() {
			setWindowHeight(window.innerHeight)
		}

		window.addEventListener('resize', handleResize)
		handleResize() // Set initial height

		// Cleanup event listener on component unmount
		return () => window.removeEventListener('resize', handleResize)
	}, [])

	return (
		<>
			{/* "At-top-tracker" */}
			<div ref={atTopTracker} />
			<Navigation
				user={user}
				pathname={pathname}
				mode={(isHomePage || isSignupPage) && isAtTop ? 'float' : 'full'}
			/>

			<Outlet />
		</>
	)
}
export default NavLayout
