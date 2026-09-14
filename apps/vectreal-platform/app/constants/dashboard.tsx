import { Skeleton } from '@shared/components/ui/skeleton'

import {
	ACTION_VARIANT,
	type DashboardContentConfig,
	type RouteContext
} from '../types/dashboard'

/**
 * Route path constants - single source of truth for dashboard routes
 */
/**
 * Publisher route helpers
 */
export const PUBLISHER_ROUTES = {
	NEW: '/publisher',
	SCENE: (sceneId: string) => `/publisher/${sceneId}`,
	withContext: (projectId?: string | null, folderId?: string | null) => {
		const params = new URLSearchParams()
		if (projectId) params.set('projectId', projectId)
		if (folderId) params.set('folderId', folderId)
		const qs = params.toString()
		return qs ? `/publisher?${qs}` : '/publisher'
	}
} as const

export const DASHBOARD_ROUTES = {
	DASHBOARD: '/dashboard',
	PROJECTS: '/dashboard/projects',
	API_KEYS: '/dashboard/api-keys',
	ORGANIZATIONS: '/dashboard/organizations',
	ORGANIZATION_DETAIL: (organizationId: string) =>
		`/dashboard/organizations/${organizationId}`,
	USAGE: '/dashboard/usage',
	BILLING: '/dashboard/billing',
	BILLING_UPGRADE: '/dashboard/billing/upgrade',
	BILLING_UPGRADE_SUCCESS: '/dashboard/billing/upgrade-success',
	BILLING_UPGRADE_CANCELED: '/dashboard/billing/upgrade-canceled',
	SETTINGS: '/dashboard/settings',
	PROJECT_DETAIL: (projectId: string) => `/dashboard/projects/${projectId}`,
	FOLDER_DETAIL: (projectId: string, folderId: string) =>
		`/dashboard/projects/${projectId}/folder/${folderId}`,
	SCENE_DETAIL: (projectId: string, sceneId: string) =>
		`/dashboard/projects/${projectId}/${sceneId}`
} as const

/**
 * Unified dashboard content configuration by route context
 * Includes both loaded and optimistic (loading) state content
 */
export const DASHBOARD_CONTENT: Record<RouteContext, DashboardContentConfig> = {
	dashboard: {
		// Not "Recent Activity": there is no activity or audit log behind this
		// page. It is scenes ordered by `updatedAt`, plus plan usage.
		title: 'Overview',
		// One job now. Usage moved to its own route, so this page is what it was
		// always for: getting back to the thing you were doing.
		description: 'Pick up where you left off.',
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: ACTION_VARIANT.DASHBOARD
	},
	'project-list': {
		title: 'Projects',
		// Not "workspace environments". No such thing exists in the product: the
		// only environment settings are the publisher's HDRI lighting panel, which
		// belongs to a scene and is not reachable from here.
		description: 'Your projects across every organization you belong to',
		loadingTitle: <Skeleton className="h-6 w-1/3" />,
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: ACTION_VARIANT.PROJECT_LIST
	},
	'api-keys': {
		title: 'API Keys',
		description: 'Manage project-scoped API keys for preview and embed access',
		loadingTitle: <Skeleton className="h-6 w-1/3" />,
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: ACTION_VARIANT.API_KEYS_LIST
	},
	'project-detail': {
		title: 'Project',
		actionVariant: ACTION_VARIANT.PROJECT_DETAIL
	},
	'folder-detail': {
		title: 'Folder',
		actionVariant: ACTION_VARIANT.FOLDER_DETAIL
	},
	'scene-detail': {
		title: 'Scene',
		actionVariant: ACTION_VARIANT.SCENE_DETAIL
	},
	organizations: {
		title: 'Organizations',
		description: 'Manage your organizations and teams',
		loadingTitle: 'Organizations',
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: ACTION_VARIANT.ORG_LIST
	},
	'organization-detail': {
		title: 'Organization',
		description: 'Organization details and member access',
		loadingTitle: 'Organization',
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: undefined
	},
	/*
	  Consumption, not money. It used to be a panel on billing and a band on the
	  overview, so the same five readings answered a question neither page was
	  asking.
	*/
	usage: {
		title: 'Usage',
		/*
		  No description. `description` is optional, and this route answers itself
		  one line further down: the verdict card states the actual situation in a
		  specific sentence ("Scene storage is close to its limit"), which a generic
		  one above it can only weaken by being read first.
		*/
		loadingTitle: 'Usage',
		/*
		  No `loadingDescription` either. It drew a skeleton bar during navigation
		  for a subtitle that then never arrived, so the header promised a line and
		  took it away - a skeleton is a claim about what is coming.
		*/
		actionVariant: undefined
	},
	billing: {
		title: 'Billing & Plans',
		/*
		  No description, for the reason `usage` above has none: the page answers
		  itself. `describeBillingSituation` states the actual situation - "Nothing
		  is being charged", "Renews Oct 12, 2026", "A payment failed" - and the
		  static line it replaces promised "your plan, and how it is paid for"
		  above a page that has never named a charge for anybody.

		  No `loadingDescription` either. It drew a skeleton bar during navigation
		  for a sentence that was a constant three lines above it, which is a claim
		  that something is being fetched when nothing is.
		*/
		loadingTitle: 'Billing & Plans',
		actionVariant: undefined
	},
	/*
	  Neutral for the same reason as the confirmation below, and because this
	  chrome is also the parent breadcrumb of that page: a reader moving down
	  read "Upgrade" twice in the trail above a card saying otherwise.
	*/
	'billing-checkout': {
		title: 'Change Plan',
		description: 'Choose a plan and continue to secure payment',
		loadingTitle: 'Change Plan',
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: undefined
	},
	/*
	  Neutral on purpose: this route confirms every direct plan change, including
	  one that moves down. The card below names the specific change.
	*/
	'billing-checkout-success': {
		title: 'Plan Change Confirmed',
		description: 'Your new plan is syncing now',
		loadingTitle: 'Plan Change Confirmed',
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: undefined
	},
	'billing-checkout-canceled': {
		title: 'Upgrade Paused',
		description: 'No charge was made and your plan is unchanged',
		loadingTitle: 'Upgrade Paused',
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: undefined
	},
	settings: {
		title: 'Settings',
		// Named, rather than "your account settings and preferences", which is the
		// title again in more words. These are the three things the page holds.
		description: 'Your display name, theme, and cookie choices',
		loadingTitle: 'Settings',
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: undefined
	}
} as const
