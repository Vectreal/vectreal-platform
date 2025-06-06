import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail
} from '@vctrl-ui/ui/sidebar'
import { List, Settings } from 'lucide-react'

// Menu items.
const items = [
	{
		title: 'Home',
		url: '#',
		icon: List
	},
	{
		title: 'Settings',
		url: '#',
		icon: Settings
	}
]

const DashboardSidebar = () => {
	return (
		<Sidebar variant="inset" collapsible="icon">
			<SidebarHeader>zayy</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Application</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{items.map((item) => (
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
			</SidebarContent>
			<SidebarRail />
			<SidebarFooter>zooo</SidebarFooter>
		</Sidebar>
	)
}

export default DashboardSidebar
