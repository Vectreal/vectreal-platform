/**
 * Dashboard Layout Wrapper Component
 * @description Main layout wrapper with sidebar and content area
 */

import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger
} from '@shared/components/ui/sidebar'
import { memo, useState } from 'react'
import { Outlet, useParams } from 'react-router'

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
})

DashboardLayoutWrapper.displayName = 'DashboardLayoutWrapper'
