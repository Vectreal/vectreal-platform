import { useIsAtTop } from '@vctrl-ui/hooks/use-is-at-top'
import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'

import { Route } from './+types/nav-layout'
import Navigation from './navigation'

export const loader = async ({ request }: Route.LoaderArgs) => {
	const location = new URL(request.url)
	const pathname = location.pathname

	return {
		pathname
	}
}

const NavLayout = ({ loaderData }: Route.ComponentProps) => {
	const { pathname } = loaderData
	const isHomePage = pathname === '/' || pathname === '/home'

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
				isHomePage={isHomePage}
				mode={isHomePage && isAtTop ? 'float' : 'full'}
			/>

			<Outlet />
		</>
	)
}
export default NavLayout
