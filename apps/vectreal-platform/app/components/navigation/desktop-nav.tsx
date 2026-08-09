import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { LayoutDashboard, LogIn, Rocket } from 'lucide-react'
import { useLocation, Link } from 'react-router'

import { isNavItemActive } from './nav-items'
import { UserMenu } from '../user-menu'
import { NavItem } from './types'

import type { User } from '@supabase/supabase-js'

interface DesktopNavProps {
	user: User | null
	navItems: NavItem[]
	onLogout: () => void
	isAuthPage: boolean
	className?: string
}

function DesktopNav({
	user,
	navItems,
	onLogout,
	isAuthPage,
	className
}: DesktopNavProps) {
	const { pathname } = useLocation()

	return (
		<nav
			className={cn(
				'fixed top-0 right-0 left-0 z-50 items-center justify-center p-4',
				className
			)}
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

				{/* Center nav links */}
				{navItems.length > 0 && (
					<div className="relative flex items-center gap-0.5">
						{navItems.map((item) => (
							<Link
								key={item.to}
								to={item.to}
								className={cn(
									'relative z-10 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors',
									isNavItemActive(item, pathname)
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
