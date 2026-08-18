import { usePostHog } from '@posthog/react'
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
	redirect,
	useFetchers,
	useLoaderData,
	useLocation,
	useNavigation,
	useRevalidator,
	type MetaFunction
} from 'react-router'

import { Route } from './+types/dashboard-layout'
import { useConsent } from '../../components/consent/consent-context'
import { PostHogIdentify } from '../../components/consent/posthog-identify'
import {
	DashboardHeader,
	DashboardManagementDialogs,
	DashboardSidebarContent,
	DynamicBreadcrumb,
	LogoSidebar
} from '../../components/dashboard'
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
import { buildDashboardCapabilities } from '../../lib/domain/dashboard/dashboard-capabilities'
import { getSidebarProjects } from '../../lib/domain/project/project-repository.server'
import { getUserOrganizations } from '../../lib/domain/user/user-repository.server'
import {
	isDashboardOverlayPath,
	shouldRevalidateWithinScope
} from '../../lib/navigation/dashboard-route-behavior'
import { buildMeta } from '../../lib/seo'

import type { ShouldRevalidateFunction } from 'react-router'

export const meta: MetaFunction = () =>
	buildMeta(
		[
			{ title: 'Dashboard - Vectreal' },
			{ property: 'og:title', content: 'Dashboard - Vectreal' }
		],
		undefined,
		{ private: true }
	)

export async function loader({ request }: Route.LoaderArgs) {
	const { user, headers } = await loadAuthenticatedSession(request)
	const [sidebarProjects, orgs] = await Promise.all([
		getSidebarProjects(user.id, 3),
		getUserOrganizations(user.id)
	])

	// Safety net: if the user has no org yet (e.g. bypassed onboarding), send them
	// through onboarding which calls initializeUserDefaults and creates the org.
	if (orgs.length === 0) {
		return redirect('/onboarding', { headers })
	}

	const primaryOrgId = orgs[0]?.organization.id ?? null
	const { plan } = primaryOrgId
		? await getOrgSubscription(primaryOrgId)
		: { plan: 'free' as const }

	// Role-only, deliberately without project quota: every dashboard route needs
	// to know what the user may do, but only the projects routes gate on quota,
	// and looking it up here would cost two round trips per organization on
	// every dashboard page.
	const capabilities = buildDashboardCapabilities(orgs)

	return data({ user, sidebarProjects, plan, capabilities }, { headers })
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
	return shouldRevalidateWithinScope({
		currentPathname: currentUrl.pathname,
		nextPathname: nextUrl.pathname,
		formMethod,
		actionResult,
		defaultShouldRevalidate,
		scopePrefix: '/dashboard'
	})
}

/**
 * Dashboard Layout
 * @description Production-ready dashboard layout
 */

const DashboardLayout = () => {
	const { user, sidebarProjects, plan } = useLoaderData<typeof loader>()
	const { consent } = useConsent()
	const posthog = usePostHog()
	const location = useLocation()
	const navigation = useNavigation()
	const revalidator = useRevalidator()
	useAuthResumeRevalidation({ enabled: Boolean(user) })
	const fetchers = useFetchers()
	const [sidebarOpen, setSidebarOpen] = useState(true)

	const orgId = sidebarProjects[0]?.organizationId
	useEffect(() => {
		if (!orgId) return
		posthog?.group('organization', orgId, { plan })
	}, [orgId, plan])
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
	// Both drawer shapes: the nested one, and the list-scoped
	// `/dashboard/projects/edit/:projectId`, which `sceneDetailRegex` below
	// would otherwise claim as a scene.
	const projectEditRegex =
		/^\/dashboard\/projects\/(?:([^/]+)\/edit|edit\/([^/]+))$/
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
	const willBeDashboardOverlayRoute = isDashboardOverlayPath(path)
	const willBePublisherRoute = publisherRegex.test(path)
	const willBeOverlayRoute =
		willBeNewProjectCreation ||
		willBeProjectEditRoute ||
		willBeDashboardOverlayRoute ||
		willBePublisherRoute

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

	/*
	  One store per mount. Jotai creates it here, so dashboard UI state
	  (selection, dialogs, the upgrade modal) starts empty on every entry
	  instead of surviving in a module singleton.
	*/
	return (
		<Provider>
			<>
				<PostHogIdentify
					userId={user.id}
					email={user.email}
					name={user.user_metadata?.full_name as string | undefined}
				/>
				{/*
				  The shell owns the viewport height so the inset can scroll its own
				  content. Without this the wrapper grows with the page and the inset's
				  rounded frame scrolls away with it.
				*/}
				<SidebarProvider
					className="h-svh overflow-hidden"
					open={sidebarOpen}
					onOpenChange={handleSidebarOpenChange}
					persistState={consent?.functional === true}
				>
					<LogoSidebar>
						<DashboardSidebarContent
							user={user}
							sidebarProjects={sidebarProjects}
							plan={plan}
						/>
					</LogoSidebar>
					{/*
					  Two rows: the breadcrumb bar, then everything else. The bar used to
					  be `fixed w-dvw`, which spanned the whole viewport — across the
					  sidebar and past the inset's rounded corners — and needed an `mt-14`
					  on the content to compensate. As a grid row it is bounded by the
					  inset by construction, and the content scrolls beneath it.
					*/}
					<SidebarInset className="relative grid min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
						<DashboardManagementDialogs />
						<UpgradeModal />

						{/*
						  Rows are pinned explicitly because the dialogs above are also
						  children of this grid. They portal their content and so occupy no
						  row today, but nothing about the layout should depend on that.
						*/}
						<div className="row-start-1 flex min-w-0 items-center gap-3 px-4 py-3">
							<SidebarTrigger className="shrink-0" />
							{/*
							  `min-w-0` lets the breadcrumb shrink below its content width,
							  which is what lets it scroll instead of pushing the bar wider.
							*/}
							<div className="flex min-w-0 flex-1 items-center gap-2">
								<DynamicBreadcrumb />
								{isBackgroundRefreshing && (
									<Loader2 className="text-muted-foreground h-3.5 w-3.5 shrink-0 animate-spin" />
								)}
							</div>
						</div>

						<div className="row-start-2 min-h-0 overflow-y-auto">
							{!(isSceneDetailRoute && willBePublisherRoute) &&
								!(isSceneDetailRoute || willBeSceneDetail) && (
									<DashboardHeader />
								)}
							{isContentNavigationLoading && !willBeOverlayRoute ? (
								skeleton
							) : (
								<Outlet />
							)}
						</div>
					</SidebarInset>
				</SidebarProvider>
			</>
		</Provider>
	)
}

export default DashboardLayout
