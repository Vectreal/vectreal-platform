import { usePostHog } from '@posthog/react'
import { useIsMobile } from '@shared/components/hooks/use-mobile'
import { Rocket, DollarSign, BookOpen, Newspaper, Mail } from 'lucide-react'
import { useCallback } from 'react'
import { useFetcher, useLocation } from 'react-router'

import DesktopNav from './desktop-nav'
import MobileNav from './mobile-nav'

import type { NavItem, NavigationProps } from './types'

type NavContext = 'marketing' | 'docs' | 'auth'

function getNavContext(pathname: string): NavContext {
	if (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) {
		return 'auth'
	}
	if (pathname.startsWith('/docs')) {
		return 'docs'
	}
	return 'marketing'
}

const MARKETING_ITEMS: NavItem[] = [
	{
		label: 'Publisher',
		to: '/publisher',
		icon: <Rocket className="size-4" />
	},
	{
		label: 'Pricing',
		to: '/pricing',
		icon: <DollarSign className="size-4" />
	},
	{ label: 'Docs', to: '/docs', icon: <BookOpen className="size-4" /> },
	{
		label: 'Newsroom',
		to: '/news-room',
		icon: <Newspaper className="size-4" />
	},
	{
		label: 'Contact',
		to: '/contact',
		icon: <Mail className="size-4" />
	}
]

export const Navigation = ({ user, isMobileRequest }: NavigationProps) => {
	const isMobile = useIsMobile(isMobileRequest)
	const { submit } = useFetcher()
	const posthog = usePostHog()
	const { pathname } = useLocation()

	const context = getNavContext(pathname)
	const isHomePage = pathname === '/' || pathname === '/home'
	const isAuthPage = context === 'auth'

	const handleLogout = useCallback(async () => {
		posthog?.reset()
		await submit(null, {
			method: 'post',
			action: '/auth/logout'
		})
	}, [posthog, submit])

	if (isMobile) {
		return (
			<MobileNav
				user={user}
				navItems={MARKETING_ITEMS}
				onLogout={handleLogout}
				isHomePage={isHomePage}
				isAuthPage={isAuthPage}
			/>
		)
	}

	return (
		<DesktopNav
			user={user}
			navItems={MARKETING_ITEMS}
			onLogout={handleLogout}
			isHomePage={isHomePage}
			isAuthPage={isAuthPage}
		/>
	)
}
