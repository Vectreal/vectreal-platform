import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { motion } from 'framer-motion'
import { LayoutDashboard, LogIn, Rocket } from 'lucide-react'
import { useRef, useState, useCallback, useLayoutEffect } from 'react'
import { useLocation, Link } from 'react-router'

import { UserMenu } from '../user-menu'
import { NavItem } from './types'
import { ThemeToggleButton } from '../theme-toggle-button'

import type { User } from '@supabase/supabase-js'

interface PillBounds {
	left: number
	width: number
}

interface SlidingPillProps {
	items: NavItem[]
	activeIndex: number
	hoveredIndex: number | null
	containerRef: React.RefObject<HTMLDivElement | null>
}

function SlidingPill({
	items,
	activeIndex,
	hoveredIndex,
	containerRef
}: SlidingPillProps) {
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
					isHovering ? 'bg-muted/80' : 'bg-accent/15 border-accent/20 border'
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
			<div className="from-background absolute inset-0 z-0 h-12 bg-linear-to-b to-transparent backdrop-blur-sm" />
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
