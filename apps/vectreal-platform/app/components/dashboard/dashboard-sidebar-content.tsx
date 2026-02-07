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
	SidebarRail
} from '@shared/components/ui/sidebar'
import type { User } from '@supabase/supabase-js'
import {
	ArrowRight,
	Building,
	ChevronsUpDown,
	List,
	LogOut,
	Rocket,
	Settings
} from 'lucide-react'
import { Link, useFetcher } from 'react-router'

// Menu items
const manageLinks = [
	{
		title: 'Projects',
		url: '/dashboard/projects',
		icon: List
	},
	{
		title: 'Organizations',
		url: '/dashboard/organizations',
		icon: Building
	},
	{
		title: 'Settings',
		url: '/dashboard/settings',
		icon: Settings
	}
]

const quickLinks = [
	{
		title: 'Publisher',
		url: '/publisher',
		icon: Rocket
	}
]

interface DashboardSidebarContentProps {
	user: User | null
}

const DashboardSidebarContent = ({ user }: DashboardSidebarContentProps) => {
	const { submit } = useFetcher()

	const userImageSrc = user?.user_metadata?.avatar_url || ''
	const userName =
		user?.user_metadata?.full_name ||
		user?.user_metadata?.name ||
		user?.email ||
		'User'
	const userInitial = userName.charAt(0).toUpperCase()
	// TODO: Replace with actual tier from user data when implemented
	const accountTier = 'Free'

	const handleLogout = () => {
		submit(null, {
			method: 'get',
			action: '/auth/logout'
		})
	}

	return (
		<>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Manage</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{manageLinks.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton asChild>
										<Link viewTransition to={item.url}>
											<item.icon />
											<span>{item.title}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupLabel>Quick Links</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{quickLinks.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton asChild>
										<Link viewTransition to={item.url}>
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
			</SidebarContent>
			<SidebarRail />
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
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
									<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
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
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<Link to="/dashboard/settings" viewTransition>
										<Settings />
										Settings
									</Link>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={handleLogout}>
									<LogOut />
									Log Out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</>
	)
}

export default DashboardSidebarContent
