import {
	Avatar,
	AvatarFallback,
	AvatarImage
} from '@shared/components/ui/avatar'
import { Button } from '@shared/components/ui/button'
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

import { useAuth } from '../../contexts/auth-context'

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

export const DashboardSidebarContent = () => {
	const { user } = useAuth()
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
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							className="flex h-fit w-full gap-2 p-2 text-left"
						>
							<Avatar className="h-10 w-10">
								<AvatarImage src={userImageSrc} alt={userName} />
								<AvatarFallback>{userInitial}</AvatarFallback>
							</Avatar>

							<div className="flex grow items-center">
								<div className="flex flex-1 grow flex-col overflow-hidden">
									<span className="truncate text-sm font-medium">
										{userName}
									</span>
									<span className="text-muted-foreground truncate text-xs">
										{accountTier} Plan
									</span>
								</div>

								<ChevronsUpDown className="mr-2" />
							</div>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent side="top" align="end" className="w-56">
						<DropdownMenuLabel>My Account</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild>
							<Link to="/dashboard/settings" viewTransition>
								<Settings className="mr-2 h-4 w-4" />
								<span>Settings</span>
							</Link>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={handleLogout}>
							<LogOut className="mr-2 h-4 w-4" />
							<span>Log Out</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarFooter>
		</>
	)
}
