import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger
} from '@shared/components/ui/sidebar'
import { useState } from 'react'
import { Outlet, useParams } from 'react-router'

import {
	DashboardHeader,
	DashboardSidebarContent,
	DynamicBreadcrumb
} from '../../components/dashboard'
import { LogoSidebar } from '../../components/layout-components'

/**
 * Dashboard Layout
 * @description Production-ready dashboard layout
 */

const DashboardLayout = () => {
	const [sidebarOpen, setSidebarOpen] = useState(true)

	const toggleSidebar = () => {
		setSidebarOpen((prev) => !prev)
	}

	const { sceneId } = useParams()

	return (
		<SidebarProvider open={sidebarOpen} onOpenChange={toggleSidebar}>
			<LogoSidebar open={sidebarOpen}>
				<DashboardSidebarContent />
			</LogoSidebar>
			<SidebarInset className="relative overflow-hidden">
				<div className="from-background/75 absolute top-0 z-50 h-20 w-full bg-gradient-to-b to-transparent" />
				<div className="absolute z-50 flex items-center gap-4 p-4 px-6 pl-4">
					<SidebarTrigger />
					<DynamicBreadcrumb />
				</div>
				{!sceneId && (
					<div className="mt-16">
						<DashboardHeader />
					</div>
				)}
				<Outlet />
			</SidebarInset>
		</SidebarProvider>
	)
}

export default DashboardLayout
