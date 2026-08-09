import { usePostHog } from '@posthog/react'
import { useCallback } from 'react'
import { useFetcher, useLocation } from 'react-router'

import DesktopNav from './desktop-nav'
import MobileNav from './mobile-nav'
import { MARKETING_ITEMS } from './nav-items'
import { useCurrentUser } from '../../hooks/use-current-user'

function isAuthPath(pathname: string): boolean {
	return pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')
}

/**
 * Both shells render; media queries pick one.
 *
 * Branching on a device class in JS is what made the desktop bar paint on mobile
 * and flip after hydration: the seed came from a user-agent sniff, and public
 * pages are prerendered at build time (no request, so no user-agent) and cached
 * at the edge without `Vary: User-Agent`. A user-agent also answers the wrong
 * question — the branch is a 768px breakpoint, not a device.
 *
 * `md` is Tailwind's default 48rem, which matches `MOBILE_BREAKPOINT` exactly, so
 * `hidden md:flex` and `flex md:hidden` are a precise complement.
 */
export const Navigation = () => {
	const { user } = useCurrentUser()
	const { submit } = useFetcher()
	const posthog = usePostHog()
	const { pathname } = useLocation()

	const isHomePage = pathname === '/' || pathname === '/home'
	const isAuthPage = isAuthPath(pathname)

	const handleLogout = useCallback(async () => {
		posthog?.reset()
		await submit(null, {
			method: 'post',
			action: '/auth/logout'
		})
	}, [posthog, submit])

	return (
		<>
			<DesktopNav
				className="hidden md:flex"
				user={user}
				navItems={MARKETING_ITEMS}
				onLogout={handleLogout}
				isAuthPage={isAuthPage}
			/>
			<MobileNav
				className="flex md:hidden"
				user={user}
				navItems={MARKETING_ITEMS}
				onLogout={handleLogout}
				isHomePage={isHomePage}
				isAuthPage={isAuthPage}
			/>
		</>
	)
}
