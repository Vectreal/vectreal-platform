import {
	Avatar,
	AvatarFallback,
	AvatarImage
} from '@shared/components/ui/avatar'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@shared/components/ui/dropdown-menu'
import {
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar
} from '@shared/components/ui/sidebar'
import {
	ArrowRight,
	BoxesIcon,
	Building,
	ChartColumn,
	ChevronsUpDown,
	CreditCard,
	House,
	HelpCircle,
	KeyRound,
	List,
	LogOut,
	Rocket,
	Settings,
	SquareStack,
	Folder,
	FolderOpen
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useFetcher } from 'react-router'

import type { User } from '@supabase/supabase-js'

interface SidebarLinkItem {
	title: string
	url?: string
	icon: typeof List
	disabled?: boolean
}

// Menu items
const manageLinks: SidebarLinkItem[] = [
	{
		title: 'Projects',
		url: '/dashboard/projects',
		icon: FolderOpen
	},
	{
		title: 'API Keys',
		url: '/dashboard/api-keys',
		icon: KeyRound
	},
	{
		title: 'Assets',
		icon: BoxesIcon,
		disabled: true // TODO: Implement asset management
	},
	{
		title: 'Presets',
		icon: SquareStack,
		disabled: true // TODO: Implement presets management
	},
	{
		title: 'Analytics',
		icon: ChartColumn,
		disabled: true
	}
]

const quickLinks: SidebarLinkItem[] = [
	{
		title: 'Dashboard',
		url: '/dashboard',
		icon: House
	},
	{
		title: 'Upload Model',
		url: '/publisher',
		icon: Rocket
	}
]

interface DashboardSidebarContentProps {
	user: User | null
	sidebarProjects: Array<{ id: string; name: string; organizationId: string }>
	plan: string
}

const DashboardSidebarContent = ({
	user,
	sidebarProjects,
	plan
}: DashboardSidebarContentProps) => {
	const { submit } = useFetcher()
	const { toggleSidebar, openMobile } = useSidebar()
	const [isClientMounted, setIsClientMounted] = useState(false)
	useEffect(() => setIsClientMounted(true), [])

	const handleSidebarClose = () => {
		if (openMobile) {
			toggleSidebar()
		}
	}

	const userImageSrc = user?.user_metadata?.avatar_url || ''
	const userName =
		user?.user_metadata?.full_name ||
		user?.user_metadata?.name ||
		user?.email ||
		'User'
	const userInitial = userName.charAt(0).toUpperCase()
	const accountTier = plan.charAt(0).toUpperCase() + plan.slice(1)

	const handleLogout = () => {
		submit(null, {
			method: 'post',
			action: '/auth/logout'
		})
	}

	return (
		<>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Quick Links</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{quickLinks.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton asChild>
										<Link
											viewTransition
											to={item.url ?? ''}
											onClick={handleSidebarClose}
											aria-label={`Go to ${item.title}`}
										>
											<item.icon />
											<span>{item.title}</span>
											<ArrowRight className="ml-auto h-4 w-4" />
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>Projects</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{sidebarProjects.length > 0 ? (
								sidebarProjects.map((project) => (
									<SidebarMenuItem key={project.id}>
										<SidebarMenuButton asChild>
											<Link
												viewTransition
												to={`/dashboard/projects/${project.id}`}
												onClick={handleSidebarClose}
												aria-label={`Go to project ${project.name}`}
											>
												<Folder />
												<span className="truncate">{project.name}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))
							) : (
								<SidebarMenuItem aria-disabled>
									<SidebarMenuButton
										disabled
										className="pointer-events-none opacity-60"
									>
										<Folder />
										<span>No projects</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							)}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>Manage</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{manageLinks.map((item) => (
								<SidebarMenuItem
									key={item.title}
									aria-disabled={item.disabled}
									className={
										item.disabled
											? 'pointer-events-none cursor-not-allowed opacity-50'
											: ''
									}
								>
									<SidebarMenuButton
										disabled={item.disabled}
										onClick={handleSidebarClose}
										asChild
									>
										{item.disabled || !item.url ? (
											<div>
												<item.icon />
												<span>{item.title}</span>
												<span className="text-muted-foreground ml-auto text-xs">
													Coming soon
												</span>
											</div>
										) : (
											<Link
												viewTransition
												to={item.url}
												aria-label={`Go to ${item.title}`}
											>
												<item.icon />
												<span>{item.title}</span>
											</Link>
										)}
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarRail />
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						{isClientMounted ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<SidebarMenuButton
										size="lg"
										className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
									>
										<Avatar className="h-8 w-8 rounded-lg">
											<AvatarImage src={userImageSrc} alt={userName} />
											<AvatarFallback className="rounded-lg">
												{userInitial}
											</AvatarFallback>
										</Avatar>
										<div className="grid flex-1 text-left text-sm leading-tight">
											<span className="truncate font-semibold">{userName}</span>
											<span className="text-muted-foreground truncate text-xs">
												{accountTier} Plan
											</span>
										</div>
										<ChevronsUpDown className="ml-auto size-4" />
									</SidebarMenuButton>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
									side="top"
									align="end"
									sideOffset={4}
								>
									<DropdownMenuLabel className="p-0 font-normal">
										<div className="flex items-center gap-2 px-2 py-1.5 text-left text-sm">
											<span className="text-foreground text-sm font-medium">
												More settings
											</span>
										</div>
									</DropdownMenuLabel>

									<DropdownMenuSeparator />

									<DropdownMenuItem onClick={handleSidebarClose} asChild>
										<Link
											to="/dashboard/organizations"
											viewTransition
											aria-label="Go to Organizations"
										>
											<Building />
											Organizations
										</Link>
									</DropdownMenuItem>
									<DropdownMenuItem onClick={handleSidebarClose} asChild>
										<Link
											to="/dashboard/billing"
											viewTransition
											aria-label="Go to Billing"
										>
											<CreditCard />
											Billing
										</Link>
									</DropdownMenuItem>
									<DropdownMenuItem onClick={handleSidebarClose} asChild>
										<Link
											to="/dashboard/settings"
											viewTransition
											aria-label="Go to Settings"
										>
											<Settings />
											Settings
										</Link>
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem onClick={handleSidebarClose} asChild>
										<Link
											to="/docs"
											viewTransition
											aria-label="Go to Documentation"
										>
											<HelpCircle />
											Documentation
										</Link>
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem onClick={handleLogout}>
										<LogOut />
										Log Out
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						) : (
							<SidebarMenuButton
								size="lg"
								className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								disabled
							>
								<Avatar className="h-8 w-8 rounded-lg">
									<AvatarImage src={userImageSrc} alt={userName} />
									<AvatarFallback className="rounded-lg">
										{userInitial}
									</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">{userName}</span>
									<span className="text-muted-foreground truncate text-xs">
										{accountTier} Plan
									</span>
								</div>
								<ChevronsUpDown className="ml-auto size-4" />
							</SidebarMenuButton>
						)}
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</>
	)
}

export default DashboardSidebarContent
