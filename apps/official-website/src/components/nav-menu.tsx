import { forwardRef } from 'react'
import { Link, NavLink } from 'react-router'
import {
	CubeIcon,
	DiscordLogoIcon,
	FileIcon,
	GitHubLogoIcon,
	HamburgerMenuIcon,
	TwitterLogoIcon
} from '@radix-ui/react-icons'

import { cn } from '@vctrl/@vctrl-ui/utils'

import {
	Button,
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
	navigationMenuTriggerStyle,
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger
} from '@vctrl/shared/components'

import { useIsMobile } from '../lib/hooks'
import VectrealLogo from './assets/vectreal-logo'

const mainEntries: { title: string; href: string }[] = [
	{
		title: 'Editor',
		href: '/editor'
	},
	{
		title: 'Home',
		href: '/'
	},
	{
		title: 'Help',
		href: '/help'
	},
	{
		title: 'Contact',
		href: '/contact'
	}
]

const components: {
	title: string
	href: string
	description: string
	icon?: JSX.Element
}[] = [
	{
		title: 'Vectreal',
		icon: <FileIcon />,
		href: 'https://vectreal.com',
		description:
			'The fully fledged design toolkit, for your online 3D services.'
	},
	{
		title: 'Github',
		icon: <GitHubLogoIcon />,
		href: 'https://github.com/vectreal',
		description:
			'Our codebase, for 3D open source projects, you can use to build your apps.'
	},
	{
		title: 'Discord',
		icon: <DiscordLogoIcon />,
		href: 'https://discord.gg/A9a3nPkZw7',
		description: 'Join our community of 3D developers and get in touch.'
	},
	{
		title: 'Twitter',
		icon: <TwitterLogoIcon />,
		href: 'https://twitter.com/vectreal',
		description:
			'See some sneak peaks of our work and talk to us about your ideas.'
	}
]

const MobileMenu = () => {
	return (
		<Sheet>
			<SheetTrigger asChild>
				<Button variant="outline" size="icon">
					<HamburgerMenuIcon />
				</Button>
			</SheetTrigger>
			<SheetContent className="flex flex-col gap-6 pb-8">
				<SheetHeader className="text-left">
					<SheetTitle>Main menu</SheetTitle>
					<SheetDescription>Navigation</SheetDescription>
				</SheetHeader>

				<ul className="mb-auto grid gap-4 pl-2 text-lg">
					{mainEntries.map((entry) => (
						<li key={entry.title}>
							<SheetClose asChild>
								<Link to={entry.href}>{entry.title}</Link>
							</SheetClose>
						</li>
					))}
				</ul>

				<div className="flex w-full flex-row justify-between">
					{components.map((component) => (
						<Link
							key={component.title}
							className={`inline-flex items-center gap-4 text-sm text-zinc-500 hover:text-zinc-100`}
							to={component.href}
						>
							{component.icon}
						</Link>
					))}
				</div>
			</SheetContent>
		</Sheet>
	)
}

const DesktopMenu = () => {
	return (
		<NavigationMenu>
			<NavigationMenuList>
				<NavigationMenuItem>
					<NavigationMenuTrigger>Getting started</NavigationMenuTrigger>
					<NavigationMenuContent>
						<ul className="grid gap-3 p-4 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
							<li className="row-span-3">
								<NavigationMenuLink asChild>
									<Link
										className="from-muted/50 to-muted flex h-full w-full flex-col justify-end rounded-md bg-gradient-to-b p-6 no-underline outline-none select-none focus:shadow-md"
										to="/editor"
									>
										<CubeIcon className="h-6 w-6" />
										<div className="mt-4 mb-2 text-lg font-medium">
											3D Model Editor
										</div>
										<p className="text-muted-foreground text-sm leading-tight">
											Optimize your assets with our one click editor.
										</p>
									</Link>
								</NavigationMenuLink>
							</li>
							<ListItem href="/help" title="Any questions?">
								Find answers to the most common questions
							</ListItem>
							<ListItem href="/" title="Back home">
								Go back to the homepage
							</ListItem>
						</ul>
					</NavigationMenuContent>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<NavigationMenuLink
						href="/contact"
						className={navigationMenuTriggerStyle()}
					>
						Contact
					</NavigationMenuLink>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<NavigationMenuTrigger>More</NavigationMenuTrigger>
					<NavigationMenuContent>
						<ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
							{components.map((component) => (
								<ListItem
									key={component.title}
									title={component.title}
									href={component.href}
								>
									{component.description}
								</ListItem>
							))}
						</ul>
					</NavigationMenuContent>
				</NavigationMenuItem>
			</NavigationMenuList>
		</NavigationMenu>
	)
}

const NavMenu = () => {
	const isMobile = useIsMobile()

	return (
		<nav
			className={cn(
				'fixed top-0 left-0 z-50 flex w-full items-center justify-between bg-zinc-950/75 px-4 py-2 shadow-xl',
				isMobile ? 'flex-row-reverse' : 'flex-row'
			)}
		>
			{isMobile ? <MobileMenu /> : <DesktopMenu />}
			<NavLink
				to={'/'}
				className="flex h-8 items-baseline font-semibold text-[rgba(255,255,255,0.25)] text-neutral-500 transition-colors hover:text-[rgba(255,255,255,0.5)]"
			>
				<VectrealLogo /> <p className="text-xs">CORE</p>
			</NavLink>
		</nav>
	)
}

export default NavMenu

const ListItem = forwardRef<
	React.ElementRef<'a'>,
	React.ComponentPropsWithoutRef<'a'>
	// eslint-disable-next-line react/prop-types
>(({ className, title, children, ...props }, ref) => {
	return (
		<li>
			<NavigationMenuLink asChild>
				<a
					ref={ref}
					className={cn(
						'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground block space-y-1 rounded-md p-3 leading-none no-underline transition-colors outline-none select-none',
						className
					)}
					{...props}
				>
					<div className="text-sm leading-none font-medium">{title}</div>
					<p className="text-muted-foreground line-clamp-2 text-sm leading-snug">
						{children}
					</p>
				</a>
			</NavigationMenuLink>
		</li>
	)
})
ListItem.displayName = 'ListItem'
