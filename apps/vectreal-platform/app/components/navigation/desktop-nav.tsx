import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { LayoutDashboard, LogIn, Rocket } from 'lucide-react'
import { useRef } from 'react'
import { useLocation, Link } from 'react-router'

import { UserMenu } from '../user-menu'
import { NavItem } from './types'
import { ThemeToggleButton } from '../theme-toggle-button'

import type { User } from '@supabase/supabase-js'

interface DesktopNavProps {
	user: User | null
	navItems: NavItem[]
	onLogout: () => void
	isHomePage: boolean
	isAuthPage: boolean
}

function getActiveIndex(items: NavItem[], pathname: string): number {
	return items.findIndex((item) => {
		if (item.to === '/') return pathname === '/' || pathname === '/home'
		return pathname.startsWith(item.to)
	})
}

function DesktopNav({
	user,
	navItems,
	onLogout,
	isHomePage,
	isAuthPage
}: DesktopNavProps) {
	const { pathname } = useLocation()
	const containerRef = useRef<HTMLDivElement>(null)
	const activeIndex = getActiveIndex(navItems, pathname)

	return (
		<nav
			className="fixed top-0 right-0 left-0 z-50 flex items-center justify-center p-4"
			aria-label="Main navigation"
		>
			<div className="from-background absolute inset-0 z-0 h-16 bg-linear-to-b to-transparent backdrop-blur-sm" />
			<div className="z-10 flex w-full max-w-7xl items-center justify-between gap-1">
				{/* Logo */}
				<Link
					to="/"
					className="flex shrink-0 items-center px-3 py-1"
					aria-label="Home"
				>
					<VectrealLogoAnimated className="text-muted-foreground h-6" colored />
				</Link>

				{/* Center nav links with sliding pill */}
				{navItems.length > 0 && (
					<div
						ref={containerRef}
						className="relative flex items-center gap-0.5"
					>
						{navItems.map((item, i) => (
							<Link
								key={item.to}
								to={item.to}
								className={cn(
									'relative z-10 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors',
									activeIndex === i
										? 'text-foreground'
										: 'text-muted-foreground hover:text-foreground'
								)}
							>
								{item.label}
							</Link>
						))}
					</div>
				)}

				{/* Right actions */}
				<div className="flex shrink-0 items-center gap-1">
					{!isHomePage && <ThemeToggleButton />}

					{!user && !isAuthPage && (
						<>
							<Button asChild variant="ghost" size="sm" className="rounded-xl">
								<Link to="/sign-up">
									<LogIn className="size-4" />
									Sign In
								</Link>
							</Button>
						</>
					)}

					{!user && (
						<Button asChild size="sm" className="rounded-xl">
							<Link to="/publisher">
								<Rocket className="size-4" />
								Get Started
							</Link>
						</Button>
					)}

					{user && (
						<>
							<Button asChild variant="ghost" size="sm" className="rounded-xl">
								<Link to="/dashboard">
									<LayoutDashboard className="size-4" />
									Dashboard
								</Link>
							</Button>
							<UserMenu user={user} onLogout={onLogout} />
						</>
					)}
				</div>
			</div>
		</nav>
	)
}

export default DesktopNav
