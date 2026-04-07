import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger
} from '@shared/components/ui/sidebar'
import { Provider } from 'jotai/react'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
	data,
	Outlet,
	useFetchers,
	useLoaderData,
	useLocation,
	useNavigation,
	useRevalidator
} from 'react-router'

import { Route } from './+types/dashboard-layout'
import { PostHogIdentify } from '../../components/consent/posthog-identify'
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
	ProjectsGridSkeleton,
	SceneDetailsSkeleton
} from '../../components/skeletons'
import { UpgradeModal } from '../../components/upgrade/upgrade-modal'
import { useAuthResumeRevalidation } from '../../hooks/use-auth-resume-revalidation'
import { loadAuthenticatedSession } from '../../lib/domain/auth/auth-loader.server'
import { getOrgSubscription } from '../../lib/domain/billing/entitlement-service.server'
import { getSidebarProjects } from '../../lib/domain/project/project-repository.server'
import { getUserOrganizations } from '../../lib/domain/user/user-repository.server'
import { dashboardManagementStore } from '../../lib/stores/dashboard-management-store'
import { upgradeModalStore } from '../../lib/stores/upgrade-modal-store'

import type { ShouldRevalidateFunction } from 'react-router'

export async function loader({ request }: Route.LoaderArgs) {
	const { user, headers } = await loadAuthenticatedSession(request)
	const [sidebarProjects, orgs] = await Promise.all([
		getSidebarProjects(user.id, 3),
		getUserOrganizations(user.id)
	])
	const primaryOrgId = orgs[0]?.organization.id ?? null
	const { plan } = primaryOrgId
		? await getOrgSubscription(primaryOrgId)
		: { plan: 'free' as const }

	return data({ user, sidebarProjects, plan }, { headers })
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
	const { user, sidebarProjects, plan } = useLoaderData<typeof loader>()
	const location = useLocation()
	const navigation = useNavigation()
	const revalidator = useRevalidator()
	useAuthResumeRevalidation({ enabled: Boolean(user) })
	const fetchers = useFetchers()
	const [sidebarOpen, setSidebarOpen] = useState(true)
	const [showSkeleton, setShowSkeleton] = useState(false)

	const handleSidebarOpenChange = (open: boolean) => {
		setSidebarOpen(open)
	}

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

	const path = navigation.location?.pathname || ''

	// Helper to extract dashboard project subroutes
	const projectDetailRegex = /^\/dashboard\/projects\/([^/]+)$/
	const projectEditRegex = /^\/dashboard\/projects\/([^/]+)\/edit$/
	const folderDetailRegex = /^\/dashboard\/projects\/([^/]+)\/folder\/([^/]+)$/
	const sceneDetailRegex = /^\/dashboard\/projects\/([^/]+)\/([^/]+)$/
	const newProjectRegex = /^\/dashboard\/projects\/new$/
	const publisherRegex = /\/publisher/

	const isSceneDetailRoute =
		sceneDetailRegex.test(location.pathname) &&
		!projectEditRegex.test(location.pathname) &&
		!folderDetailRegex.test(location.pathname)

	const willBeNewProjectCreation = newProjectRegex.test(path)
	const willBeProjectEditRoute = projectEditRegex.test(path)
	const willBePublisherRoute = publisherRegex.test(path)

	const willBeFolderDetail =
		folderDetailRegex.test(path) &&
		!willBeProjectEditRoute &&
		!willBeNewProjectCreation
	const willBeSceneDetail =
		sceneDetailRegex.test(path) &&
		!willBeProjectEditRoute &&
		!willBeFolderDetail &&
		!willBeNewProjectCreation
	const willBeProjectDetail =
		projectDetailRegex.test(path) &&
		!willBeProjectEditRoute &&
		!willBeFolderDetail &&
		!willBeSceneDetail &&
		!willBeNewProjectCreation

	// Determine which skeleton to show based on navigation location
	const getNavigationSkeleton = () => {
		if (!showSkeleton) return null

		if (path === '/dashboard') return <DashboardSkeleton />
		if (path === '/dashboard/organizations') return <OrganizationsSkeleton />
		if (path === '/dashboard/projects') return <ProjectsGridSkeleton />
		if (willBeProjectDetail) return <ProjectContentSkeleton />
		if (willBeFolderDetail) return <FolderContentSkeleton />
		if (willBeSceneDetail) return <SceneDetailsSkeleton /> // Scene details can be variable, so we show a spinner instead of a skeleton

		// Default skeleton
		// return <CenteredSpinner text="Loading..." />
	}

	const skeleton = useMemo(getNavigationSkeleton, [showSkeleton, path])

	return (
		<Provider store={dashboardManagementStore}>
			<Provider store={upgradeModalStore}>
				<PostHogIdentify
					userId={user.id}
					email={user.email}
					name={user.user_metadata?.full_name as string | undefined}
				/>
				<SidebarProvider
					open={sidebarOpen}
					onOpenChange={handleSidebarOpenChange}
				>
					<LogoSidebar>
						<DashboardSidebarContent
							user={user}
							sidebarProjects={sidebarProjects}
							plan={plan}
						/>
					</LogoSidebar>
					<SidebarInset className="relative overflow-hidden">
						<DashboardManagementDialogs />
						<UpgradeModal />

						<div className="from-muted/25 absolute top-0 z-50 h-20 w-full bg-gradient-to-b to-transparent" />

						<div className="absolute z-50 flex items-center gap-4 p-4 px-6 pl-4">
							<SidebarTrigger />
							<div className="flex items-center gap-2">
								<DynamicBreadcrumb />
								{isBackgroundRefreshing && (
									<Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />
								)}
							</div>
						</div>
						{!(isSceneDetailRoute && willBePublisherRoute) &&
							!(isSceneDetailRoute || willBeSceneDetail) && (
								<div className="mt-16">
									<DashboardHeader />
								</div>
							)}
						{isContentNavigationLoading &&
						!willBeNewProjectCreation &&
						!willBeProjectEditRoute &&
						!willBePublisherRoute ? (
							skeleton
						) : (
							<Outlet />
						)}
					</SidebarInset>
				</SidebarProvider>
			</Provider>
		</Provider>
	)
}

export default DashboardLayout
