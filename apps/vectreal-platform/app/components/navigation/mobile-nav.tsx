import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { Button } from '@shared/components/ui/button'
import { Separator } from '@shared/components/ui/separator'
import { Sheet, SheetContent } from '@shared/components/ui/sheet'
import { cn } from '@shared/utils'
import { User } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import {
	ExternalLink,
	Home,
	LayoutDashboard,
	LogIn,
	MenuIcon,
	Rocket
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'

import { ThemeToggleButton } from '../theme-toggle-button'
import { UserMenu } from '../user-menu'
import { NavItem } from './types'

interface MobileNavProps {
	user: User | null
	navItems: NavItem[]
	onLogout: () => void
	isHomePage: boolean
	isAuthPage: boolean
}

const drawerItemVariants = {
	hidden: { opacity: 0, x: 24 },
	visible: (i: number) => ({
		opacity: 1,
		x: 0,
		transition: {
			delay: 0.06 * i,
			type: 'spring' as const,
			stiffness: 300,
			damping: 24
		}
	})
}

function MobileNav({
	user,
	navItems,
	onLogout,
	isHomePage,
	isAuthPage
}: MobileNavProps) {
	const { pathname } = useLocation()
	const [drawerOpen, setDrawerOpen] = useState(false)

	// Close drawer on route change
	useEffect(() => {
		setDrawerOpen(false)
	}, [pathname])

	const allDrawerItems: NavItem[] = [
		...(user
			? [
					{
						label: 'Dashboard',
						to: '/dashboard',
						icon: <LayoutDashboard className="size-4" />
					}
				]
			: []),
		{ label: 'Home', to: '/', icon: <Home className="size-4" /> },
		...navItems
	]

	return (
		<>
			<nav
				className="fixed top-0 right-0 left-0 z-50 flex items-center justify-between p-2"
				aria-label="Main navigation"
			>
				<div className="from-background absolute inset-0 z-0 h-12 bg-linear-to-b to-transparent backdrop-blur-sm" />
				<div className="relative flex w-full items-center justify-between">
					{/* Logo */}
					<Link
						to="/"
						className="flex items-center px-3 py-1"
						aria-label="Home"
					>
						<VectrealLogoAnimated
							className="text-muted-foreground h-5"
							colored
						/>
					</Link>

					{/* Right: login + burger */}
					<div className="flex items-center gap-1">
						{!user && !isAuthPage && (
							<Button asChild size="sm" variant="ghost" className="rounded-xl">
								<Link to="/sign-up">
									<LogIn className="size-4" />
									Sign In
								</Link>
							</Button>
						)}

						{user && <UserMenu user={user} onLogout={onLogout} />}

						<Button
							variant="ghost"
							size="icon"
							className="rounded-xl"
							onClick={() => setDrawerOpen((o) => !o)}
							aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
							aria-expanded={drawerOpen}
						>
							<MenuIcon />
						</Button>
					</div>
				</div>
			</nav>

			{/* Mobile drawer */}
			<Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
				<SheetContent
					side="right"
					className="bg-background/80 border-border/40 flex flex-col gap-0 pt-8 backdrop-blur-2xl"
				>
					{/* Publisher CTA for unauthenticated users */}
					{!user && (
						<div className="px-4 pt-4">
							<Button asChild className="w-full rounded-xl" size="lg">
								<Link to="/publisher">
									<Rocket className="size-4" />
									Get Started
								</Link>
							</Button>
						</div>
					)}

					{/* Nav links */}
					<div className="flex flex-1 flex-col gap-1 py-4">
						{allDrawerItems.map((item, i) => {
							const isActive =
								item.to === '/'
									? pathname === '/' || pathname === '/home'
									: pathname.startsWith(item.to)
							return (
								<motion.div
									key={item.to}
									custom={i}
									variants={drawerItemVariants}
									initial="hidden"
									animate="visible"
								>
									<Link
										to={item.to}
										className={cn(
											'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
											isActive
												? 'bg-accent bg-opacity-10 text-accent'
												: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
										)}
									>
										{item.icon}
										{item.label}
										{isActive && (
											<motion.div
												className="bg-accent ml-auto h-1.5 w-1.5 rounded-full"
												layoutId="mobile-active-dot"
											/>
										)}
									</Link>
								</motion.div>
							)
						})}
					</div>

					<Separator className="bg-border/50" />

					{/* Bottom actions */}
					<div className="flex flex-col gap-2 pt-4 pb-2">
						{!isHomePage && (
							<>
								<div className="flex items-center justify-between px-3">
									<span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
										Theme
									</span>
									<ThemeToggleButton />
								</div>
								<Separator className="bg-border/50 my-2" />
							</>
						)}

						<div className="flex items-center gap-2 px-3">
							<Link
								to="https://github.com/vectreal/"
								className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs transition-colors"
							>
								GitHub
								<ExternalLink className="size-3" />
							</Link>
							<span className="text-muted-foreground/40">·</span>
							<Link
								to="https://discord.gg/A9a3nPkZw7"
								className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs transition-colors"
							>
								Discord
								<ExternalLink className="size-3" />
							</Link>
						</div>
					</div>
				</SheetContent>
			</Sheet>
		</>
	)
}

export default MobileNav
