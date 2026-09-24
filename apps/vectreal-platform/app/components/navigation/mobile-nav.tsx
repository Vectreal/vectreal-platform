import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { useIsMobile } from '@shared/components/hooks/use-mobile'
import { Button } from '@shared/components/ui/button'
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle
} from '@shared/components/ui/sheet'
import { cn } from '@shared/utils'
import { User } from '@supabase/supabase-js'
import { MenuIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'

import { isNavItemActive } from './nav-items'
import { ACCOUNT, NAV, type SiteLink } from '../../lib/navigation/site-map'
import { DocsBreadcrumb, isDocsPath } from '../docs/docs-breadcrumb'
import { ThemeToggleButton } from '../theme-toggle-button'
import { UserAvatar, userFirstName } from '../user-menu'

interface MobileNavProps {
	user: User | null
	onLogout: () => void
	isHomePage: boolean
	isAuthPage: boolean
	/** Content runs under the bar: it settles onto a surface of its own. */
	scrolled: boolean
	className?: string
}

const SETTLE =
	'duration-(--duration-slow) ease-(--ease-out) motion-reduce:transition-none'

const DrawerLink = ({
	link,
	pathname
}: {
	link: SiteLink
	pathname: string
}) => {
	const className = cn(
		'block rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
		!link.external && isNavItemActive(link, pathname)
			? 'bg-accent text-foreground'
			: 'text-muted-foreground hover:bg-accent hover:text-foreground'
	)
	return link.external ? (
		<a href={link.to} target="_blank" rel="noreferrer" className={className}>
			{link.label}
		</a>
	) : (
		<Link
			to={link.to}
			aria-current={isNavItemActive(link, pathname) ? 'page' : undefined}
			className={className}
		>
			{link.label}
		</Link>
	)
}

/**
 * The phone's bar and drawer. The bar settles the way the desktop bar does;
 * the drawer lists the same site map the desktop panels and the footer read,
 * grouped the same way, with the reader's own block on top: their account
 * when signed in, the way in when not.
 *
 * The bar has one menu control. Signed in it is the avatar, which opens this
 * drawer rather than a dropdown of its own, so a docs page does not show the
 * docs picker, an account menu and a site menu side by side.
 */
function MobileNav({
	user,
	onLogout,
	isAuthPage,
	scrolled,
	className
}: MobileNavProps) {
	const { pathname, key: locationKey } = useLocation()
	const isMobile = useIsMobile()
	const [drawerOpen, setDrawerOpen] = useState(false)
	const onDocs = isDocsPath(pathname)

	// Every navigation closes it, query-only ones included: keyed on the location, not the path.
	useEffect(() => {
		setDrawerOpen(false)
	}, [locationKey])

	/*
	  This nav hides itself at the desktop breakpoint with `md:hidden`, but the
	  drawer cannot: `SheetContent` renders `SheetOverlay` as a sibling inside its
	  portal and does not forward `className` to it, so hiding the panel alone
	  would strand a full-screen scrim over the desktop layout. Close it instead.

	  Reading the viewport here does not reintroduce the hydration flip this
	  component's `md:hidden` exists to fix: the drawer is always closed at first
	  paint, so there is nothing for server and client to disagree about.
	*/
	useEffect(() => {
		if (!isMobile) setDrawerOpen(false)
	}, [isMobile])

	return (
		<>
			<nav
				data-scrolled={scrolled || undefined}
				className={cn(
					'z-nav fixed top-0 right-0 left-0 items-center justify-between p-2 transition-colors',
					SETTLE,
					scrolled ? 'bg-background' : 'bg-transparent',
					className
				)}
				aria-label="Main navigation"
			>
				<div className="flex w-full items-center justify-between gap-2">
					<div className="flex shrink-0 items-center">
						<Link
							to="/"
							className="flex shrink-0 items-center px-3 py-1"
							aria-label="Home"
						>
							<VectrealLogoAnimated
								className="text-muted-foreground h-5"
								colored
							/>
						</Link>
					</div>

					<div className="flex min-w-0 items-center gap-1">
						{onDocs && <DocsBreadcrumb pathname={pathname} compact />}
						<Button
							variant={user ? 'secondary' : 'ghost'}
							size="icon"
							className="shrink-0 rounded-xl"
							onClick={() => setDrawerOpen((o) => !o)}
							// The avatar says "account" to a sighted reader; the name has to say it to everyone else.
							aria-label={
								drawerOpen
									? 'Close menu'
									: user
										? 'Open menu and account'
										: 'Open menu'
							}
							aria-expanded={drawerOpen}
						>
							{user ? <UserAvatar user={user} /> : <MenuIcon />}
						</Button>
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

			<Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
				<SheetContent
					side="right"
					className="flex flex-col gap-0 overflow-y-auto border-l-0 pt-8"
				>
					<SheetHeader className="px-4">
						<SheetTitle>Menu</SheetTitle>
						<SheetDescription className="sr-only">
							Every part of the site, and a way in.
						</SheetDescription>
					</SheetHeader>

					<div className="px-4 pt-2">
						{user ? (
							<section aria-label="Account">
								<div className="flex items-center gap-3 px-3">
									<UserAvatar user={user} />
									<div className="min-w-0">
										<p className="truncate text-sm font-medium">
											{userFirstName(user)}
										</p>
										<p className="text-muted-foreground text-body-sm truncate">
											{user.email}
										</p>
									</div>
								</div>
								<ul className="mt-3 flex flex-col">
									{ACCOUNT.map((link) => (
										<li key={link.to}>
											<DrawerLink link={link} pathname={pathname} />
										</li>
									))}
								</ul>
							</section>
						) : (
							<div className="flex flex-col gap-2">
								<Button asChild className="w-full rounded-xl" size="lg">
									<Link to={NAV.getStarted.to}>{NAV.getStarted.label}</Link>
								</Button>
								{!isAuthPage && (
									<Button
										asChild
										variant="secondary"
										className="w-full rounded-xl"
										size="lg"
									>
										<Link to={NAV.signIn.to}>{NAV.signIn.label}</Link>
									</Button>
								)}
							</div>
						)}
					</div>

					<div className="flex flex-1 flex-col gap-8 px-4 py-8">
						{NAV.panels.map((section) => (
							<section key={section.label} aria-label={section.label}>
								<h2 className="text-eyebrow text-muted-foreground px-3">
									{section.label}
								</h2>
								<ul className="mt-2 flex flex-col">
									{section.links.map((link) => (
										<li key={link.to}>
											<DrawerLink link={link} pathname={pathname} />
										</li>
									))}
								</ul>
							</section>
						))}
						<ul className="flex flex-col">
							{NAV.links.map((link) => (
								<li key={link.to}>
									<DrawerLink link={link} pathname={pathname} />
								</li>
							))}
						</ul>
					</div>

					<div className="flex items-center justify-between px-7 pb-6">
						<span className="text-muted-foreground text-eyebrow">Theme</span>
						<ThemeToggleButton />
					</div>
					{user && (
						<div className="px-4 pb-8">
							<Button
								variant="ghost"
								className="text-muted-foreground w-full justify-start rounded-xl px-3"
								onClick={() => {
									// Closed at once, as the dropdown it replaces closed on select: a drawer left open over the request invites a second tap.
									setDrawerOpen(false)
									onLogout()
								}}
							>
								Log out
							</Button>
						</div>
					)}
				</SheetContent>
			</Sheet>
		</>
	)
}

export default MobileNav
