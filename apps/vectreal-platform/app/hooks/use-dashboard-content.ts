/**
 * Dashboard Content Hook
 * @description Composable hook for generating dashboard header content and breadcrumbs
 * Replaces complex nested logic with clean switch-based routing
 */

import { pluralize } from '@shared/utils'
import { useMemo } from 'react'
import { useLocation, useMatches } from 'react-router'

import {
	extractRouteData,
	getRouteContext,
	parseRouteParams
} from '../components/dashboard'
import { DASHBOARD_CONTENT, DASHBOARD_ROUTES } from '../constants/dashboard'
import { PLAN_DISPLAY_NAMES } from '../constants/product-copy'
import { describeBillingSituation } from '../lib/domain/billing/billing-situation'
import {
	ACTION_VARIANT,
	type BreadcrumbItem,
	type DynamicHeaderContent
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
	const matches = useMatches()

	// Parse current route
	const routeParams = parseRouteParams(location.pathname)
	const routeContext = getRouteContext(location.pathname, routeParams)

	// Extract typed data from route loaders
	const { project, folder, scene, organizationDetail, usage, billing } =
		extractRouteData(matches)

	const content = useMemo(() => {
		/*
		  The chrome follows the committed route, never the pending one. This
		  used to read `navigation.location` while a navigation was in flight
		  and render the destination's header over the page that was still on
		  screen, which is the header doing the opposite of what
		  `dashboard-layout.tsx` already decided for the page body: hold what is
		  on screen until the new loader resolves, rather than swap to something
		  else mid-flight. A route the header has no entry for (the publisher,
		  which lives outside this switch entirely) fell through to the
		  dashboard's own header and briefly replaced a suppressed scene header
		  with a visible one, shifting the whole layout for the length of the
		  navigation. The header is part of the page that holds; it does not get
		  a separate rule.
		*/

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
					/*
					  The situation is this page's description, for the reason usage's
					  verdict is: the slot states what is true of the route right now.
					  The static sentence it replaces promised "how it is paid for"
					  above a page that never named a charge, and read identically to
					  an account paying nothing and one whose card had just been
					  declined.

					  `config` carries no description to fall back to, deliberately.
					  Before the loader resolves there is no situation to report, and
					  a generic line in the slot is what this replaced.
					*/
					description: billing
						? describeBillingSituation(billing.billing).headline
						: undefined,
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
		usage,
		billing
	])

	return content
}
