import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger
} from '@shared/components/ui/sidebar'
import { Provider } from 'jotai/react'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
	Outlet,
	useFetchers,
	useLoaderData,
	useLocation,
	useNavigation,
	useParams,
	useRevalidator
} from 'react-router'

import { Route } from './+types/dashboard-layout'
import CenteredSpinner from '../../components/centered-spinner'
import {
	DashboardHeader,
	DashboardManagementDialogs,
	DashboardSidebarContent,
	DynamicBreadcrumb
} from '../../components/dashboard'
import { LogoSidebar } from '../../components/layout-components'
import {
	DashboardSkeleton,
	FolderContentSkeleton,
	OrganizationsSkeleton,
	ProjectContentSkeleton,
	ProjectsGridSkeleton
} from '../../components/skeletons'
import { loadAuthenticatedSession } from '../../lib/domain/auth/auth-loader.server'
import { dashboardManagementStore } from '../../lib/stores/dashboard-management-store'

import type { ShouldRevalidateFunction } from 'react-router'

export async function loader({ request }: Route.LoaderArgs) {
	const { user } = await loadAuthenticatedSession(request)

	return { user }
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

	if (defaultShouldRevalidate) {
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
	const location = useLocation()
	const navigation = useNavigation()
	const revalidator = useRevalidator()
	const fetchers = useFetchers()
	const [sidebarOpen, setSidebarOpen] = useState(true)
	const [showSkeleton, setShowSkeleton] = useState(false)

	const handleSidebarOpenChange = (open: boolean) => {
		setSidebarOpen(open)
	}

	const { sceneId } = useParams()
	const isSearchParamOnlyNavigation =
		navigation.state === 'loading' &&
		navigation.location?.pathname === location.pathname
	const isContentNavigationLoading =
		navigation.state === 'loading' && !isSearchParamOnlyNavigation
	const isBackgroundRefreshing =
		!isContentNavigationLoading &&
		(revalidator.state !== 'idle' ||
			fetchers.some((fetcher) => fetcher.state !== 'idle'))

	// Smart skeleton display logic:
	// - Skip on back/forward navigation (browser buttons)
	// - Only show after 200ms delay to avoid flicker on fast loads
	useEffect(() => {
		if (!isContentNavigationLoading) {
			setShowSkeleton(false)
			return
		}

		// Delay skeleton display by 200ms to avoid flicker on fast navigations
		const timer = setTimeout(() => {
			if (isContentNavigationLoading) {
				setShowSkeleton(true)
			}
		}, 200)

		return () => clearTimeout(timer)
	}, [isContentNavigationLoading])

	const path = navigation.location?.pathname || location.pathname
	const isNewProjectCreation = path === '/dashboard/projects/new'
	const isPublisherRoute = path.startsWith('/publisher')

	// Determine which skeleton to show based on navigation location
	const getNavigationSkeleton = () => {
		if (!showSkeleton) return null

		const isFolderDetail = path.match(/\/dashboard\/projects\/[^/]+\/folder\//)
		const isSceneDetail = path.match(/\/dashboard\/projects\/[^/]+\/[^/]+$/)
		const isProjectDetail = path.match(/\/dashboard\/projects\/[^/]+$/)

		if (path === '/dashboard') return <DashboardSkeleton />
		if (path === '/dashboard/organizations') return <OrganizationsSkeleton />
		if (path === '/dashboard/projects') return <ProjectsGridSkeleton />
		if (isProjectDetail) return <ProjectContentSkeleton />
		if (isFolderDetail) return <FolderContentSkeleton />
		if (isSceneDetail) return <CenteredSpinner text="Loading scene..." /> // Scene details can be variable, so we show a spinner instead of a skeleton

		// Default skeleton
		// return <CenteredSpinner text="Loading..." />
	}

	const skeleton = useMemo(getNavigationSkeleton, [showSkeleton, path])

	return (
		<Provider store={dashboardManagementStore}>
			<SidebarProvider
				open={sidebarOpen}
				onOpenChange={handleSidebarOpenChange}
			>
				<LogoSidebar open={sidebarOpen}>
					<DashboardSidebarContent user={user} />
				</LogoSidebar>
				<SidebarInset className="relative overflow-hidden">
					<DashboardManagementDialogs />
					{!sceneId && (
						<div className="from-background/75 absolute top-0 z-50 h-20 w-full bg-gradient-to-b to-transparent" />
					)}
					<div className="absolute z-50 flex items-center gap-4 p-4 px-6 pl-4">
						<SidebarTrigger />
						<div className="flex items-center gap-2">
							<DynamicBreadcrumb />
							{isBackgroundRefreshing && (
								<Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />
							)}
						</div>
					</div>
					{!sceneId && (
						<div className="mt-16">
							<DashboardHeader />
						</div>
					)}
					{isContentNavigationLoading &&
					!isNewProjectCreation &&
					!isPublisherRoute ? (
						skeleton
					) : (
						<Outlet />
					)}
				</SidebarInset>
			</SidebarProvider>
		</Provider>
	)
}

export default DashboardLayout
