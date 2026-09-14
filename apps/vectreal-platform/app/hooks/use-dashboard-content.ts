/**
 * Dashboard Content Hook
 * @description Composable hook for generating dashboard header content and breadcrumbs
 * Replaces complex nested logic with clean switch-based routing
 */

import { pluralize } from '@shared/utils'
import { useMemo } from 'react'
import { useLocation, useMatches, useNavigation } from 'react-router'

import {
	extractRouteData,
	getRouteContext,
	identifyDrawerRoute,
	parseRouteParams
} from '../components/dashboard'
import { DASHBOARD_CONTENT, DASHBOARD_ROUTES } from '../constants/dashboard'
import { PLAN_DISPLAY_NAMES } from '../constants/product-copy'
import {
	ACTION_VARIANT,
	type BreadcrumbItem,
	type DynamicHeaderContent,
	type NavigationState
} from '../types/dashboard'

/**
 * What something holds, for the line under its name.
 *
 * One sentence per page, because it answers one question. A project read
 * `3 items • 1 folders • 2 scenes`, stating the sum of its own two parts and
 * agreeing with neither; a folder read `1 items in Acme`, naming a project the
 * breadcrumb directly above already names; an organization read
 * `1 members • 1 projects`. Every organization in production holds one project
 * and most hold one member, so the singular is the normal reading rather than
 * an edge case.
 *
 * A variadic list rather than fixed arguments because there are now three
 * callers and they count different things. Zero parts are dropped rather than
 * printed: an empty container's own empty state says so, and says it with
 * somewhere to go next, and nothing at all is better under a title than
 * `0 members`.
 */
function describeCounts(
	...parts: readonly (readonly [number, string])[]
): string | undefined {
	const said = parts
		.filter(([count]) => count > 0)
		.map(([count, noun]) => pluralize(count, noun))

	return said.length > 0 ? said.join(' • ') : undefined
}

/**
 * Main dashboard content hook that provides header and breadcrumb data
 * Uses composable pattern with single-level switch statements for clarity
 * Handles both optimistic (loading) and loaded states
 * @returns Dashboard header content with title, description, action variant, and breadcrumbs
 */
export const useDashboardHeaderData = (): DynamicHeaderContent => {
	const location = useLocation()
	const navigation = useNavigation()
	const matches = useMatches()

	// Parse current route
	const routeParams = parseRouteParams(location.pathname)
	const routeContext = getRouteContext(location.pathname, routeParams)

	// Extract typed data from route loaders
	const { project, folder, scene, organizationDetail, usage } =
		extractRouteData(matches)

	const content = useMemo(() => {
		// Skip optimistic updates for drawer routes to prevent flickering

		const isDashboardRootRoute = (pathname: string) => pathname === '/dashboard'

		// Handle optimistic updates during navigation (skip for drawer routes)
		if (
			navigation.state === 'loading' &&
			navigation.location &&
			navigation.location.pathname !== location.pathname &&
			!isDashboardRootRoute(location.pathname) &&
			!identifyDrawerRoute(location.pathname) &&
			!identifyDrawerRoute(navigation.location.pathname)
		) {
			const nextRouteContext = getRouteContext(
				navigation.location.pathname,
				parseRouteParams(navigation.location.pathname)
			)
			const nextConfig = DASHBOARD_CONTENT[nextRouteContext]
			const navState = navigation.location.state as NavigationState | null

			// Use navigation state for instant updates (passed from DashboardCards)
			if (navState?.name) {
				const fallbackDescription =
					nextConfig.loadingDescription || nextConfig.description
				const itemDescription =
					navState.description ||
					(navState.projectName
						? `${navState.type === 'scene' ? 'Scene' : 'Folder'} in ${navState.projectName}`
						: fallbackDescription)

				// Determine action variant from navigation state
				let actionVariant = nextConfig.actionVariant
				switch (navState.type) {
					case 'scene':
						actionVariant = ACTION_VARIANT.SCENE_DETAIL
						break
					case 'folder':
						actionVariant = ACTION_VARIANT.FOLDER_DETAIL
						break
					case 'project':
						actionVariant = ACTION_VARIANT.PROJECT_DETAIL
						break
				}

				return {
					title: navState.name,
					description: itemDescription,
					actionVariant,
					isLoading: true
				}
			}

			// Use optimistic route context for static routes
			return {
				title: nextConfig.loadingTitle || nextConfig.title,
				description: nextConfig.loadingDescription || nextConfig.description,
				actionVariant: nextConfig.actionVariant,
				isLoading: true
			}
		}

		// Generate content based on loaded route context
		switch (routeContext) {
			/*
			  The verdict is this page's description. It states what is true of the
			  route right now - "Nothing needs your attention", "Scene storage is
			  close to its limit" - which is what the slot is for, where the static
			  sentence it replaces only restated the title.
			*/
			case 'usage':
				if (usage) {
					return {
						title: DASHBOARD_CONTENT.usage.title,
						description: usage.verdict.headline,
						actionVariant: DASHBOARD_CONTENT.usage.actionVariant,
						breadcrumbs: [
							{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
							{ label: DASHBOARD_CONTENT.usage.title, isLast: true }
						]
					}
				}
				break

			case 'organization-detail':
				if (organizationDetail) {
					const breadcrumbs: BreadcrumbItem[] = [
						{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
						{
							label: DASHBOARD_CONTENT.organizations.title,
							to: DASHBOARD_ROUTES.ORGANIZATIONS
						},
						{ label: organizationDetail.organization.name, isLast: true }
					]

					/*
					  The plan belongs on this line rather than in a tile or a lone
					  paragraph below the title. It is a fact about the organization
					  the way the two counts are, and every fact about the
					  organization now reads in one place.
					*/
					const orgCounts = describeCounts(
						[organizationDetail.members.length, 'member'],
						[organizationDetail.projectsTotal, 'project']
					)
					const planLabel = `${PLAN_DISPLAY_NAMES[organizationDetail.billing.plan]} plan`

					return {
						title: organizationDetail.organization.name,
						description: orgCounts ? `${orgCounts} • ${planLabel}` : planLabel,
						actionVariant: undefined,
						breadcrumbs
					}
				}
				break

			case 'scene-detail':
				if (scene?.scene && scene?.project) {
					const folderPath = scene.folderPath || []
					const folderBreadcrumbs: BreadcrumbItem[] = folderPath.map(
						(pathFolder) => ({
							label: pathFolder.name || 'Folder',
							to: DASHBOARD_ROUTES.FOLDER_DETAIL(
								scene.project.id,
								pathFolder.id
							)
						})
					)

					const breadcrumbs: BreadcrumbItem[] = [
						{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
						{ label: 'Projects', to: DASHBOARD_ROUTES.PROJECTS },
						{
							label: scene.project.name || 'Project',
							to: DASHBOARD_ROUTES.PROJECT_DETAIL(scene.project.id)
						},
						...folderBreadcrumbs,
						{ label: scene.scene.name || 'Scene', isLast: true }
					]

					return {
						title: scene.scene.name,
						description:
							scene.scene.description || `Scene in ${scene.project.name}`,
						actionVariant: ACTION_VARIANT.SCENE_DETAIL,
						breadcrumbs
					}
				}
				break

			case 'folder-detail':
				if (folder?.folder && folder?.project) {
					const folderPath =
						folder.folderPath && folder.folderPath.length > 0
							? folder.folderPath
							: [folder.folder]

					const folderBreadcrumbs: BreadcrumbItem[] = folderPath.map(
						(pathFolder, index) => {
							const isLastFolder = index === folderPath.length - 1

							return {
								label: pathFolder.name || 'Folder',
								to: isLastFolder
									? undefined
									: DASHBOARD_ROUTES.FOLDER_DETAIL(
											folder.project.id,
											pathFolder.id
										),
								isLast: isLastFolder
							}
						}
					)

					const breadcrumbs: BreadcrumbItem[] = [
						{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
						{ label: 'Projects', to: DASHBOARD_ROUTES.PROJECTS },
						{
							label: folder.project.name || 'Project',
							to: DASHBOARD_ROUTES.PROJECT_DETAIL(folder.project.id)
						},
						...folderBreadcrumbs
					]

					return {
						title: folder.folder.name,
						description:
							folder.folder.description ||
							describeCounts(
								[folder.subfolders?.length || 0, 'folder'],
								[folder.scenes?.length || 0, 'scene']
							),
						actionVariant: ACTION_VARIANT.FOLDER_DETAIL,
						breadcrumbs
					}
				}
				break

			case 'project-detail':
				if (project?.project) {
					const breadcrumbs: BreadcrumbItem[] = [
						{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
						{ label: 'Projects', to: DASHBOARD_ROUTES.PROJECTS },
						{ label: project.project.name || 'Project', isLast: true }
					]

					return {
						title: project.project.name,
						description: describeCounts(
							[project.folders?.length || 0, 'folder'],
							[project.scenes?.length || 0, 'scene']
						),
						actionVariant: ACTION_VARIANT.PROJECT_DETAIL,
						breadcrumbs
					}
				}
				break

			case 'project-list': {
				const config = DASHBOARD_CONTENT['project-list']
				const breadcrumbs: BreadcrumbItem[] = [
					{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
					{ label: config.title, isLast: true }
				]

				return {
					title: config.title,
					description: config.description,
					actionVariant: config.actionVariant,
					breadcrumbs
				}
			}

			case 'api-keys': {
				const config = DASHBOARD_CONTENT['api-keys']
				const breadcrumbs: BreadcrumbItem[] = [
					{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
					{ label: config.title, isLast: true }
				]

				return {
					title: config.title,
					description: config.description,
					actionVariant: config.actionVariant,
					breadcrumbs
				}
			}

			case 'organizations': {
				const config = DASHBOARD_CONTENT.organizations
				const breadcrumbs: BreadcrumbItem[] = [
					{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
					{ label: config.title, isLast: true }
				]

				return {
					title: config.title,
					description: config.description,
					actionVariant: config.actionVariant,
					breadcrumbs
				}
			}

			case 'usage': {
				const config = DASHBOARD_CONTENT.usage
				const breadcrumbs: BreadcrumbItem[] = [
					{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
					{ label: config.title, isLast: true }
				]

				return {
					title: config.title,
					description: config.description,
					actionVariant: config.actionVariant,
					breadcrumbs
				}
			}

			case 'billing': {
				const config = DASHBOARD_CONTENT.billing
				const breadcrumbs: BreadcrumbItem[] = [
					{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
					{ label: config.title, isLast: true }
				]

				return {
					title: config.title,
					description: config.description,
					actionVariant: config.actionVariant,
					breadcrumbs
				}
			}

			case 'billing-checkout': {
				const config = DASHBOARD_CONTENT['billing-checkout']
				const breadcrumbs: BreadcrumbItem[] = [
					{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
					{
						label: DASHBOARD_CONTENT.billing.title,
						to: DASHBOARD_ROUTES.BILLING
					},
					{ label: config.title, isLast: true }
				]

				return {
					title: config.title,
					description: config.description,
					actionVariant: config.actionVariant,
					breadcrumbs
				}
			}

			case 'billing-checkout-success': {
				const config = DASHBOARD_CONTENT['billing-checkout-success']
				const breadcrumbs: BreadcrumbItem[] = [
					{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
					{
						label: DASHBOARD_CONTENT.billing.title,
						to: DASHBOARD_ROUTES.BILLING
					},
					{
						label: DASHBOARD_CONTENT['billing-checkout'].title,
						to: DASHBOARD_ROUTES.BILLING_UPGRADE
					},
					{ label: config.title, isLast: true }
				]

				return {
					title: config.title,
					description: config.description,
					actionVariant: config.actionVariant,
					breadcrumbs
				}
			}

			case 'billing-checkout-canceled': {
				const config = DASHBOARD_CONTENT['billing-checkout-canceled']
				const breadcrumbs: BreadcrumbItem[] = [
					{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
					{
						label: DASHBOARD_CONTENT.billing.title,
						to: DASHBOARD_ROUTES.BILLING
					},
					{
						label: DASHBOARD_CONTENT['billing-checkout'].title,
						to: DASHBOARD_ROUTES.BILLING_UPGRADE
					},
					{ label: config.title, isLast: true }
				]

				return {
					title: config.title,
					description: config.description,
					actionVariant: config.actionVariant,
					breadcrumbs
				}
			}

			case 'settings': {
				const config = DASHBOARD_CONTENT.settings
				const breadcrumbs: BreadcrumbItem[] = [
					{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
					{ label: config.title, isLast: true }
				]

				return {
					title: config.title,
					description: config.description,
					actionVariant: config.actionVariant,
					breadcrumbs
				}
			}

			case 'dashboard':
			default: {
				const config = DASHBOARD_CONTENT.dashboard
				const breadcrumbs: BreadcrumbItem[] = [
					{ label: config.title, isLast: true }
				]

				return {
					title: config.title,
					description: config.description,
					actionVariant: config.actionVariant,
					breadcrumbs
				}
			}
		}

		// Fallback to dashboard config
		const config = DASHBOARD_CONTENT.dashboard
		return {
			title: config.title,
			description: config.description,
			actionVariant: config.actionVariant
		}
	}, [
		location.pathname,
		routeContext,
		project,
		folder,
		scene,
		organizationDetail,
		navigation.state,
		navigation.location,
		usage
	])

	return content
}
