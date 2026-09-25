import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { LayoutDashboard } from 'lucide-react'
import { useLocation, Link } from 'react-router'

import { isNavItemActive } from './nav-items'
import { NavPanels } from './nav-panels'
import { NAV, entersFunnel } from '../../lib/navigation/site-map'
import { DocsBreadcrumb, isDocsPath } from '../docs/docs-breadcrumb'
import { UserMenu } from '../user-menu'

import type { User } from '@supabase/supabase-js'

interface DesktopNavProps {
	user: User | null
	onLogout: () => void
	isAuthPage: boolean
	/** Content runs under the bar: it settles onto a surface of its own. */
	scrolled: boolean
	className?: string
}

const SETTLE =
	'duration-(--duration-slow) ease-(--ease-out) motion-reduce:transition-none'

/**
 * The site's bar.
 *
 * At the top of a page it has no surface: it sits on the page like its
 * heading does. Once content runs under it, it settles once onto the page's
 * own color, a little shorter, with a hairline under it that is there only
 * while something is beneath. It never blurs and never hides: a blurred band
 * fought the page's dither, and a bar that leaves on the way down is gone just
 * when a reader wants to move on.
 *
 * On the docs the breadcrumb takes the place of the marketing links, so a docs
 * page has one bar rather than the nav with a second bar pinned under it.
 */
function DesktopNav({
	user,
	onLogout,
	isAuthPage,
	scrolled,
	className
}: DesktopNavProps) {
	const { pathname } = useLocation()
	const onDocs = isDocsPath(pathname)

	return (
		<nav
			data-scrolled={scrolled || undefined}
			className={cn(
				'z-nav fixed top-0 right-0 left-0 transition-colors',
				SETTLE,
				scrolled ? 'bg-background' : 'bg-transparent',
				className
			)}
			aria-label="Main navigation"
		>
			<div
				className={cn(
					'container-page flex items-center justify-between gap-6 transition-[padding]',
					SETTLE,
					scrolled ? 'py-2.5' : 'py-4'
				)}
			>
				<div className="flex shrink-0 items-center">
					<Link
						to="/"
						className="flex shrink-0 items-center py-1"
						aria-label="Home"
					>
						<VectrealLogoAnimated
							className="text-muted-foreground h-6"
							colored
						/>
					</Link>
				</div>

				<div className="flex min-w-0 items-center gap-6">
					{/* The trail takes the marketing links' place, beside the actions: next to the logo its baseline reads as off, since the wordmark sits low. */}
					{onDocs ? (
						<DocsBreadcrumb pathname={pathname} />
					) : (
						<div className="flex shrink-0 items-center gap-0.5">
							<NavPanels sections={NAV.panels} pathname={pathname} />
							{NAV.links.map((item) => {
								const isActive = isNavItemActive(item, pathname)
								return (
									<Link
										key={item.to}
										to={item.to}
										viewTransition={entersFunnel(item.to)}
										// Color alone cannot say "you are here": aria-current is what a screen reader reads it from.
										aria-current={isActive ? 'page' : undefined}
										className={cn(
											'rounded-xl px-3 py-1.5 text-sm font-medium transition-colors',
											isActive
												? 'text-foreground'
												: 'text-muted-foreground hover:text-foreground'
										)}
									>
										{item.label}
									</Link>
								)
							})}
						</div>
					)}

					<div className="flex shrink-0 items-center gap-1">
						{!user && !isAuthPage && (
							<Button asChild variant="ghost" size="sm" className="rounded-xl">
								<Link to={NAV.signIn.to}>{NAV.signIn.label}</Link>
							</Button>
						)}

						{!user && (
							<Button asChild size="sm" className="rounded-xl">
								<Link
									to={NAV.getStarted.to}
									viewTransition={entersFunnel(NAV.getStarted.to)}
								>
									{NAV.getStarted.label}
								</Link>
							</Button>
						)}

						{user && (
							<>
								<Button
									asChild
									variant="ghost"
									size="sm"
									className="rounded-xl"
								>
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
			</div>
			<div
				aria-hidden="true"
				className={cn(
					'ds-divider absolute inset-x-0 bottom-0 h-px transition-opacity',
					SETTLE,
					scrolled ? 'opacity-100' : 'opacity-0'
				)}
			/>
		</nav>
	)
}

export default DesktopNav
