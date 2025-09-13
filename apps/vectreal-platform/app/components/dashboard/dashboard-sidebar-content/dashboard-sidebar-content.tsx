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
} from '@vctrl-ui/ui/sidebar'
import { ArrowRight, Building, List, Rocket, Settings } from 'lucide-react'
import { Link } from 'react-router'

// Menu items.
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

const DashboardSidebarContent = () => {
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
			<SidebarFooter>zooo</SidebarFooter>
		</>
	)
}

export default DashboardSidebarContent
