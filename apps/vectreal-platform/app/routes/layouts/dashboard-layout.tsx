import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger
} from '@shared/components/ui/sidebar'
import { useEffect, useState } from 'react'
import { Outlet, useLoaderData, useNavigation, useParams } from 'react-router'
import type { ShouldRevalidateFunction } from 'react-router'

import {
	DashboardHeader,
	DashboardSidebarContent,
	DynamicBreadcrumb
} from '../../components/dashboard'
import { LogoSidebar } from '../../components/layout-components'
import {
	DashboardSkeleton,
	FolderContentSkeleton,
	OrganizationsSkeleton,
	ProjectContentSkeleton,
	ProjectsGridSkeleton,
	SceneDetailSkeleton
} from '../../components/skeletons'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import { getUserProjects } from '../../lib/domain/project/project-repository.server'
import { getUserOrganizations } from '../../lib/domain/user/user-repository.server'

import { Route } from './+types/dashboard-layout'

export async function loader({ request }: Route.LoaderArgs) {
	// Fetch core dashboard data once - shared by all child routes
	const { user, userWithDefaults } = await loadAuthenticatedUser(request)

	// Fetch organizations and projects in parallel
	const [organizations, projects] = await Promise.all([
		getUserOrganizations(user.id),
		getUserProjects(user.id)
	])

	return { user, userWithDefaults, organizations, projects }
}

/**
 * Prevent unnecessary data refetches when navigating between dashboard child routes.
 * Only revalidate on explicit actions or initial load.
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	defaultShouldRevalidate,
	actionResult,
	formMethod
}) => {
	// Always revalidate on form submissions
	if (formMethod && formMethod !== 'GET') {
		return true
	}

	// Always revalidate if there's an action result (explicit action submission)
	if (actionResult) {
		return true
	}

	// Same URL: don't revalidate (e.g., submitting fetcher without navigation)
	if (currentUrl.pathname === nextUrl.pathname) {
		return false
	}

	// Navigating within dashboard: don't revalidate shared parent data
	if (
		currentUrl.pathname.startsWith('/dashboard') &&
		nextUrl.pathname.startsWith('/dashboard')
	) {
		return false
	}

	// Default behavior for all other cases (initial load, navigation from outside dashboard)
	return defaultShouldRevalidate
}

/**
 * Dashboard Layout
 * @description Production-ready dashboard layout
 */

const DashboardLayout = () => {
	const { user } = useLoaderData<typeof loader>()
	const navigation = useNavigation()
	const [sidebarOpen, setSidebarOpen] = useState(true)
	const [showSkeleton, setShowSkeleton] = useState(false)

	const toggleSidebar = () => {
		setSidebarOpen((prev) => !prev)
	}

	const { sceneId } = useParams()

	// Smart skeleton display logic:
	// - Skip on back/forward navigation (browser buttons)
	// - Only show after 200ms delay to avoid flicker on fast loads
	useEffect(() => {
		if (navigation.state !== 'loading') {
			setShowSkeleton(false)
			return
		}

		// Check if this is a back/forward navigation
		// When using browser back/forward, the navigation type is "pop"
		const isBackForward =
			navigation.location?.state?.__internal_pop__ === true ||
			(typeof window !== 'undefined' &&
				(
					window.performance?.getEntriesByType?.(
						'navigation'
					)?.[0] as PerformanceNavigationTiming
				)?.type === 'back_forward')

		// Skip skeleton for back/forward navigation as cached data is likely available
		if (isBackForward) {
			setShowSkeleton(false)
			return
		}

		// Delay skeleton display by 200ms to avoid flicker on fast navigations
		const timer = setTimeout(() => {
			if (navigation.state === 'loading') {
				setShowSkeleton(true)
			}
		}, 200)

		return () => clearTimeout(timer)
	}, [navigation.state, navigation.location])

	// Determine which skeleton to show based on navigation location
	const getNavigationSkeleton = () => {
		if (!showSkeleton) return null

		const path = navigation.location?.pathname || ''

		if (path === '/dashboard') return <DashboardSkeleton />
		if (path === '/dashboard/organizations') return <OrganizationsSkeleton />
		if (path === '/dashboard/projects') return <ProjectsGridSkeleton />
		if (path.match(/\/dashboard\/projects\/[^/]+\/folder\//))
			return <FolderContentSkeleton />
		if (path.match(/\/dashboard\/projects\/[^/]+\/[^/]+$/))
			return <SceneDetailSkeleton />
		if (path.match(/\/dashboard\/projects\/[^/]+$/))
			return <ProjectContentSkeleton />

		// Default skeleton
		return <DashboardSkeleton />
	}

	return (
		<SidebarProvider open={sidebarOpen} onOpenChange={toggleSidebar}>
			<LogoSidebar open={sidebarOpen}>
				<DashboardSidebarContent user={user} />
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
				{navigation.state === 'loading' ? getNavigationSkeleton() : <Outlet />}
			</SidebarInset>
		</SidebarProvider>
	)
}

export default DashboardLayout
