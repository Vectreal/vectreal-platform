import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger
} from '@vctrl-ui/ui/sidebar'

import { Outlet } from 'react-router'

import { DashboardSidebar } from '../dashboard-page/dashboard-sidebar'

const DashboardLayout = () => {
	return (
		<main className="relative flex h-screen w-full flex-col overflow-hidden">
			<SidebarProvider>
				<DashboardSidebar />
				<SidebarInset>
					<SidebarTrigger className="m-2" />
					<Outlet />
				</SidebarInset>
			</SidebarProvider>
		</main>
	)
}

export default DashboardLayout
