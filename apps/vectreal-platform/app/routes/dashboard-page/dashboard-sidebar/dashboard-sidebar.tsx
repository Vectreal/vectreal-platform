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

// Menu items.
const manageLinks = [
	{
		title: 'Projects',
		url: '#',
		icon: List
	},
	{
		title: 'Organizations',
		url: '#',
		icon: Building
	},
	{
		title: 'Settings',
		url: '#',
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

const DashboardSidebar = () => {
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
										<a href={item.url}>
											<item.icon />
											<span>{item.title}</span>
										</a>
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
										<a href={item.url}>
											<item.icon />
											<span>{item.title}</span>
											<ArrowRight className="ml-auto h-4 w-4" />
										</a>
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

export default DashboardSidebar
