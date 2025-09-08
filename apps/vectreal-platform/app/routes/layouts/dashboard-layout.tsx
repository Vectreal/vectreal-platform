import { Button } from '@vctrl-ui/ui/button'
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger
} from '@vctrl-ui/ui/sidebar'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, Outlet, useLocation, useParams } from 'react-router'

import { LogoSidebar } from '../../components'
import { DashboardSidebarContent } from '../../components/dashboard'
import { useProjectCreationCapabilities } from '../../hooks'

type View = 'projects' | 'organizations' | 'settings'
interface TitleContent {
	title: string
	description: string
}

const titleContent: Record<View, TitleContent> = {
	projects: {
		title: 'Projects',
		description: 'Manage your projects and workspace environments'
	},
	organizations: {
		title: 'Organizations',
		description: 'Manage your organizations and teams'
	},
	settings: {
		title: 'Settings',
		description: 'Manage your account settings and preferences'
	}
}

const DashboardLayout = () => {
	const location = useLocation()
	const view = location.pathname.split('/')[2] as View

	const creationCapabilities = useProjectCreationCapabilities()
	const [sidebarOpen, setSidebarOpen] = useState(true)
	const toggleSidebar = () => {
		setSidebarOpen((prev) => !prev)
	}

	console.log('Current view:', view)

	const { title, description } = titleContent[view] || {
		title: 'Dashboard',
		description: 'Manage your workspace and projects'
	}

	return (
		<SidebarProvider open={sidebarOpen} onOpenChange={toggleSidebar}>
			<LogoSidebar open={sidebarOpen}>
				<DashboardSidebarContent />
			</LogoSidebar>
			<SidebarInset className="relative overflow-clip">
				<div className="flex items-start justify-between gap-4 p-4 px-6 pl-4">
					<SidebarTrigger />
					{creationCapabilities.canCreateProjects && (
						<Link to="/dashboard/projects/new">
							<Button>
								<Plus className="mr-2 h-4 w-4" />
								New Project
							</Button>
						</Link>
					)}
				</div>
				<div className="space-y-8 p-6">
					<div className="flex grow items-start justify-between">
						<div>
							<h1 className="text-5xl font-normal">{title}</h1>
							<p className="text-gray-600">{description}</p>
						</div>
					</div>
				</div>
				<Outlet />
			</SidebarInset>
		</SidebarProvider>
	)
}

export default DashboardLayout
