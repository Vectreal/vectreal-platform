import { usePostHog } from '@posthog/react'
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger
} from '@shared/components/ui/sidebar'
import { cn } from '@shared/utils'
import { Provider } from 'jotai/react'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
	data,
	Outlet,
	redirect,
	useFetchers,
	useLoaderData,
	useLocation,
	useNavigation,
	useParams,
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
import { UpgradeModal } from '../../components/upgrade/upgrade-modal'
import { useAuthResumeRevalidation } from '../../hooks/use-auth-resume-revalidation'
import { loadAuthenticatedSession } from '../../lib/domain/auth/auth-loader.server'
import { getOrgSubscription } from '../../lib/domain/billing/entitlement-service.server'
import { getSidebarProjects } from '../../lib/domain/project/project-repository.server'
import { getUserOrganizations } from '../../lib/domain/user/user-repository.server'
import { shouldRevalidateWithinScope } from '../../lib/navigation/dashboard-route-behavior'
import { buildMeta } from '../../lib/seo'

import type { DashboardActor } from '../../lib/domain/dashboard/dashboard-types'
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

	/*
	  Four fields of the actor, not the actor.

	  A layout's payload is serialized into every route beneath it, so the whole
	  Supabase `User` was reaching the browser on every dashboard page - with
	  `identities`, both metadata bags, `email_confirmed_at` and `aud` - to feed
	  a sidebar that wants a name and an avatar and a PostHog call that wants an
	  id and an email.

	  `capabilities` went the same way and was simpler: `buildDashboardCapabilities`
	  ran on every dashboard request and nothing has ever read the result. The
	  three routes that need it build their own, which is why nobody noticed.
	*/
	const actor: DashboardActor = {
		id: user.id,
		email: user.email ?? null,
		name:
			(user.user_metadata?.full_name as string | undefined) ||
			(user.user_metadata?.name as string | undefined) ||
			user.email ||
			'User',
		avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null
	}

	return data({ actor, sidebarProjects, plan }, { headers })
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
	const { actor, sidebarProjects, plan } = useLoaderData<typeof loader>()
	const { consent } = useConsent()
	const posthog = usePostHog()
	const location = useLocation()
	const { projectId, sceneId } = useParams()
	const navigation = useNavigation()
	const revalidator = useRevalidator()
	useAuthResumeRevalidation({ enabled: true })
	const fetchers = useFetchers()
	const [sidebarOpen, setSidebarOpen] = useState(true)

	const orgId = sidebarProjects[0]?.organizationId
	useEffect(() => {
		if (!orgId) return
		posthog?.group('organization', orgId, { plan })
	}, [orgId, plan])

	const handleSidebarOpenChange = (open: boolean) => {
		setSidebarOpen(open)
	}

	const isSearchParamOnlyNavigation =
		navigation.state === 'loading' &&
		navigation.location?.pathname === location.pathname
	const isContentNavigationLoading =
		navigation.state === 'loading' && !isSearchParamOnlyNavigation
	const isSceneDetailsRoute = projectId && sceneId

	/*
	  Any work in flight, including a route change. This used to exclude a
	  content navigation, because the skeleton was the signal for that one - with
	  the skeleton gone the page holds its previous content, so without this a
	  slow route change showed nothing but a 1px bar at the top of the viewport.
	*/
	const isLoadingAnything =
		isContentNavigationLoading ||
		revalidator.state !== 'idle' ||
		fetchers.some((fetcher) => fetcher.state !== 'idle')

	/*
	  One store per mount. Jotai creates it here, so dashboard UI state
	  (selection, dialogs, the upgrade modal) starts empty on every entry
	  instead of surviving in a module singleton.
	*/
	return (
		<Provider>
			<PostHogIdentify
				userId={actor.id}
				email={actor.email ?? undefined}
				name={actor.name}
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
						actor={actor}
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
							{isLoadingAnything && (
								<Loader2 className="text-muted-foreground h-3.5 w-3.5 shrink-0 animate-spin" />
							)}
						</div>
					</div>

					<div
						className={cn(
							'row-start-2 min-h-0 overflow-y-auto px-4',
							!isSceneDetailsRoute && 'container-page'
						)}
					>
						{/*
						  Unconditionally. `DashboardHeader` already returns nothing when
						  its action variant is `SCENE_DETAIL`, so the scene page - which
						  draws its own heading - suppressed it twice.

						  Six regexes and five flags lived here to make that second
						  decision, re-deriving what `getRouteContext` resolves to a typed
						  union and what the header then resolves again from its own data.
						  The condition was also self-cancelling:
						  `!(isSceneDetailRoute && willBePublisherRoute) &&
						  !(isSceneDetailRoute || willBeSceneDetail)` reduces to the second
						  clause alone, so the publisher regex never decided anything.

						  Found by mutating it: pointing the route comparison at
						  `folder-detail` changed nothing on a scene page, because the
						  component had been deciding all along.
						*/}
						<DashboardHeader />
						{/*
						  Always the outlet. A client-side navigation keeps the page
						  that is already on screen until the new loader resolves,
						  which is React Router's own behaviour and costs nothing to
						  get - the previous route's component simply stays mounted.

						  This used to swap in a skeleton after 200ms. Blanking a
						  correct page to grey bars is a step backwards from holding
						  it: the data on screen is real until the moment it is
						  replaced. Progress is reported by `GlobalNavigationLoader`
						  at the top of the viewport and by the spinner beside the
						  breadcrumb above.
						*/}
						<Outlet />
					</div>
				</SidebarInset>
			</SidebarProvider>
		</Provider>
	)
}

export default DashboardLayout
