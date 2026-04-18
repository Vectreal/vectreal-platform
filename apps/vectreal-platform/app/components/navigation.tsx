import { usePostHog } from '@posthog/react'
import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { useIsMobile } from '@shared/components/hooks/use-mobile'
import { Button } from '@shared/components/ui/button'
import { Separator } from '@shared/components/ui/separator'
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle
} from '@shared/components/ui/sheet'
import { cn } from '@shared/utils'
import { User } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import {
	ArrowRight,
	BookOpen,
	DollarSign,
	ExternalLink,
	LayoutDashboard,
	LogIn,
	Newspaper,
	Rocket
} from 'lucide-react'
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState
} from 'react'
import { Link, useFetcher, useLocation } from 'react-router'

import { ThemeToggleButton } from './theme-toggle-button'
import { UserMenu } from './user-menu'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavItem {
	label: string
	to: string
	icon: React.ReactNode
	external?: boolean
}

interface NavigationProps {
	user: User | null
}

// ---------------------------------------------------------------------------
// Route-adaptive navigation config
// ---------------------------------------------------------------------------

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
	{ label: 'Docs', to: '/docs', icon: <BookOpen className="size-4" /> },
	{
		label: 'Pricing',
		to: '/pricing',
		icon: <DollarSign className="size-4" />
	},
	{
		label: 'News Room',
		to: '/news-room',
		icon: <Newspaper className="size-4" />
	},
	{
		label: 'Publisher',
		to: '/publisher',
		icon: <Rocket className="size-4" />
	}
]

const DOCS_ITEMS: NavItem[] = [
	{
		label: 'Pricing',
		to: '/pricing',
		icon: <DollarSign className="size-4" />
	},
	{
		label: 'News Room',
		to: '/news-room',
		icon: <Newspaper className="size-4" />
	},
	{
		label: 'Publisher',
		to: '/publisher',
		icon: <Rocket className="size-4" />
	}
]

function getNavItems(context: NavContext): NavItem[] {
	switch (context) {
		case 'docs':
			return DOCS_ITEMS
		case 'auth':
			return []
		default:
			return MARKETING_ITEMS
	}
}

function getActiveIndex(items: NavItem[], pathname: string): number {
	return items.findIndex((item) => {
		if (item.to === '/') return pathname === '/' || pathname === '/home'
		return pathname.startsWith(item.to)
	})
}

// ---------------------------------------------------------------------------
// Sliding pill indicator — the signature interaction
// ---------------------------------------------------------------------------

interface PillBounds {
	left: number
	width: number
}

function SlidingPill({
	items,
	activeIndex,
	hoveredIndex,
	containerRef
}: {
	items: NavItem[]
	activeIndex: number
	hoveredIndex: number | null
	containerRef: React.RefObject<HTMLDivElement | null>
}) {
	const [bounds, setBounds] = useState<PillBounds | null>(null)
	const itemRefs = useRef<Map<number, HTMLElement>>(new Map())

	const measure = useCallback(
		(targetIndex: number) => {
			const el = itemRefs.current.get(targetIndex)
			const container = containerRef.current
			if (!el || !container) return null
			const elRect = el.getBoundingClientRect()
			const containerRect = container.getBoundingClientRect()
			return {
				left: elRect.left - containerRect.left,
				width: elRect.width
			}
		},
		[containerRef]
	)

	// Re-measure whenever the target changes
	useLayoutEffect(() => {
		const target = hoveredIndex ?? activeIndex
		if (target < 0 || target >= items.length) {
			setBounds(null)
			return
		}
		const measured = measure(target)
		if (measured) setBounds(measured)
	}, [hoveredIndex, activeIndex, items.length, measure])

	// Provide ref callback for each nav item
	const setItemRef = useCallback(
		(index: number) => (el: HTMLAnchorElement | null) => {
			if (el) {
				itemRefs.current.set(index, el)
			} else {
				itemRefs.current.delete(index)
			}
		},
		[]
	)

	const isHovering = hoveredIndex !== null
	const showPill = bounds !== null

	return {
		setItemRef,
		showPill,
		pillElement: showPill ? (
			<motion.div
				className={cn(
					'absolute top-1 bottom-1 rounded-xl',
					isHovering ? 'bg-muted/80' : 'bg-accent/10'
				)}
				animate={{
					left: bounds.left,
					width: bounds.width,
					opacity: 1
				}}
				initial={false}
				transition={{
					type: 'spring',
					stiffness: 500,
					damping: 32,
					mass: 0.8
				}}
				layoutId="nav-pill"
			/>
		) : null
	}
}

// ---------------------------------------------------------------------------
// Desktop nav
// ---------------------------------------------------------------------------

function DesktopNav({
	user,
	navItems,
	onLogout,
	isHomePage,
	isAuthPage
}: {
	user: User | null
	navItems: NavItem[]
	onLogout: () => void
	isHomePage: boolean
	isAuthPage: boolean
}) {
	const { pathname } = useLocation()
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const activeIndex = getActiveIndex(navItems, pathname)

	const { setItemRef, showPill, pillElement } = SlidingPill({
		items: navItems,
		activeIndex,
		hoveredIndex,
		containerRef
	})

	return (
		<nav
			className="fixed top-0 right-0 left-0 z-50 flex items-center justify-center p-2"
			aria-label="Main navigation"
		>
			<div className="bg-background/80 border-border/40 flex w-full max-w-3xl items-center justify-between gap-1 rounded-2xl border p-1.5 shadow-xl backdrop-blur-2xl">
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
						onMouseLeave={() => setHoveredIndex(null)}
					>
						{showPill && pillElement}
						{navItems.map((item, i) => (
							<Link
								key={item.to}
								ref={setItemRef(i)}
								to={item.to}
								onMouseEnter={() => setHoveredIndex(i)}
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
							<Button asChild size="sm" className="rounded-xl">
								<Link to="/publisher">
									<Rocket className="size-4" />
									Try Publisher
								</Link>
							</Button>
						</>
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

// ---------------------------------------------------------------------------
// Animated burger icon (morphing lines)
// ---------------------------------------------------------------------------

function BurgerIcon({ open }: { open: boolean }) {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			className="shrink-0"
		>
			<motion.line
				x1="3"
				y1="6"
				x2="21"
				y2="6"
				initial={{ x1: 3, y1: 6, x2: 21, y2: 6 }}
				animate={
					open
						? { x1: 5, y1: 5, x2: 19, y2: 19 }
						: { x1: 3, y1: 6, x2: 21, y2: 6 }
				}
				transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
			/>
			<motion.line
				x1="3"
				y1="12"
				x2="21"
				y2="12"
				initial={{ opacity: 1 }}
				animate={open ? { opacity: 0 } : { opacity: 1 }}
				transition={{ duration: 0.15 }}
			/>
			<motion.line
				x1="3"
				y1="18"
				x2="21"
				y2="18"
				initial={{ x1: 3, y1: 18, x2: 21, y2: 18 }}
				animate={
					open
						? { x1: 5, y1: 19, x2: 19, y2: 5 }
						: { x1: 3, y1: 18, x2: 21, y2: 18 }
				}
				transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
			/>
		</svg>
	)
}

// ---------------------------------------------------------------------------
// Mobile nav with drawer
// ---------------------------------------------------------------------------

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
}: {
	user: User | null
	navItems: NavItem[]
	onLogout: () => void
	isHomePage: boolean
	isAuthPage: boolean
}) {
	const { pathname } = useLocation()
	const [drawerOpen, setDrawerOpen] = useState(false)

	// Close drawer on route change
	useEffect(() => {
		setDrawerOpen(false)
	}, [pathname])

	const allDrawerItems: NavItem[] = [
		{ label: 'Home', to: '/', icon: <ArrowRight className="size-4" /> },
		...navItems,
		...(user
			? [
					{
						label: 'Dashboard',
						to: '/dashboard',
						icon: <LayoutDashboard className="size-4" />
					}
				]
			: [])
	]

	return (
		<>
			<nav
				className="fixed top-0 right-0 left-0 z-50 flex items-center justify-between p-2"
				aria-label="Main navigation"
			>
				<div className="bg-background/80 border-border/40 relative flex w-full items-center justify-between rounded-2xl border p-1.5 shadow-xl backdrop-blur-2xl">
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
							<BurgerIcon open={drawerOpen} />
						</Button>
					</div>
				</div>
			</nav>

			{/* Mobile drawer */}
			<Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
				<SheetContent
					side="right"
					className="bg-background/80 border-border/40 flex flex-col gap-0 backdrop-blur-2xl"
				>
					<SheetHeader className="pb-2">
						<SheetTitle className="flex items-center gap-2">
							<VectrealLogoAnimated
								className="text-muted-foreground h-5"
								colored
							/>
						</SheetTitle>
					</SheetHeader>

					<Separator className="bg-border/50" />

					{/* Publisher CTA for unauthenticated users */}
					{!user && (
						<div className="px-4 pt-4">
							<Button asChild className="w-full rounded-xl" size="lg">
								<Link to="/publisher">
									<Rocket className="size-4" />
									Try Publisher
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
												? 'bg-accent/10 text-accent'
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

// ---------------------------------------------------------------------------
// Main navigation export
// ---------------------------------------------------------------------------

export const Navigation = ({ user }: NavigationProps) => {
	const isMobile = useIsMobile()
	const { submit } = useFetcher()
	const posthog = usePostHog()
	const { pathname } = useLocation()

	const context = getNavContext(pathname)
	const navItems = getNavItems(context)
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
				navItems={navItems}
				onLogout={handleLogout}
				isHomePage={isHomePage}
				isAuthPage={isAuthPage}
			/>
		)
	}

	return (
		<DesktopNav
			user={user}
			navItems={navItems}
			onLogout={handleLogout}
			isHomePage={isHomePage}
			isAuthPage={isAuthPage}
		/>
	)
}
