import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger
} from '@vctrl-ui/ui/sidebar'
import { useState } from 'react'
import { Outlet } from 'react-router'

import { LogoSidebar } from '../../components'
import { DashboardSidebar } from '../dashboard-page/dashboard-sidebar'

const DashboardLayout = () => {
	const [sidebarOpen, setSidebarOpen] = useState(true)
	const toggleSidebar = () => {
		setSidebarOpen((prev) => !prev)
	}
	return (
		<main className="relative flex h-screen w-full flex-col overflow-hidden">
			<SidebarProvider open={sidebarOpen} onOpenChange={toggleSidebar}>
				<LogoSidebar open={sidebarOpen}>
					<DashboardSidebar />
				</LogoSidebar>
				<SidebarInset className="relative overflow-clip">
					<SidebarTrigger className="m-2" />
					<Outlet />
				</SidebarInset>
			</SidebarProvider>
		</main>
	)
}

export default DashboardLayout
