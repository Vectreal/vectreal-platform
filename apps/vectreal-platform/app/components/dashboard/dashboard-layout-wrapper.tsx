/**
 * Dashboard Layout Wrapper Component
 * @description Main layout wrapper with sidebar and content area
 */

import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger
} from '@vctrl-ui/ui/sidebar'
import { memo, useState } from 'react'
import { Outlet } from 'react-router'

import { LogoSidebar } from '../'

import { DashboardHeader } from './dashboard-header'
import { DashboardSidebarContent } from './dashboard-sidebar-content'
import { DynamicBreadcrumb } from './dynamic-breadcrumb'

/**
 * DashboardLayoutWrapper component provides the main layout structure
 * Includes sidebar, header with breadcrumbs, and content outlet
 * Memoized to prevent unnecessary re-renders
 */
export const DashboardLayoutWrapper = memo(() => {
	const [sidebarOpen, setSidebarOpen] = useState(true)

	const toggleSidebar = () => {
		setSidebarOpen((prev) => !prev)
	}

	return (
		<SidebarProvider open={sidebarOpen} onOpenChange={toggleSidebar}>
			<LogoSidebar open={sidebarOpen}>
				<DashboardSidebarContent />
			</LogoSidebar>
			<SidebarInset className="relative overflow-clip">
				<div className="flex items-center gap-4 p-4 px-6 pl-4">
					<SidebarTrigger />
					<DynamicBreadcrumb />
				</div>
				<DashboardHeader />

				<Outlet />
			</SidebarInset>
		</SidebarProvider>
	)
})

DashboardLayoutWrapper.displayName = 'DashboardLayoutWrapper'
