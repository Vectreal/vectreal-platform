import { Skeleton } from '@shared/components/ui/skeleton'

import {
	ACTION_VARIANT,
	type DashboardContentConfig,
	type RouteContext
} from '../types/dashboard'

/**
 * Route path constants - single source of truth for dashboard routes
 */
export const DASHBOARD_ROUTES = {
	DASHBOARD: '/dashboard',
	PROJECTS: '/dashboard/projects',
	API_KEYS: '/dashboard/api-keys',
	ORGANIZATIONS: '/dashboard/organizations',
	BILLING: '/dashboard/billing',
	BILLING_CHECKOUT: '/dashboard/billing/checkout',
	BILLING_CHECKOUT_SUCCESS: '/dashboard/billing/checkout-success',
	BILLING_CHECKOUT_CANCELED: '/dashboard/billing/checkout-canceled',
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
		title: 'Recent Activity',
		description:
			'Monitor scene progress, stay aligned with organizations, and move directly from recent work into publish-ready flows.',
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: ACTION_VARIANT.DASHBOARD
	},
	'project-list': {
		title: 'Projects',
		description: 'Manage your projects and workspace environments',
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
		description: 'Project details',
		actionVariant: ACTION_VARIANT.PROJECT_DETAIL
	},
	'folder-detail': {
		title: 'Folder',
		description: 'Folder contents',
		actionVariant: ACTION_VARIANT.FOLDER_DETAIL
	},
	'scene-detail': {
		title: 'Scene',
		description: 'Scene details',
		actionVariant: ACTION_VARIANT.SCENE_DETAIL
	},
	organizations: {
		title: 'Organizations',
		description: 'Manage your organizations and teams',
		loadingTitle: 'Organizations',
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: ACTION_VARIANT.ORG_LIST
	},
	billing: {
		title: 'Billing & Plans',
		description: 'Manage subscriptions, usage, and plan upgrades',
		loadingTitle: 'Billing & Plans',
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: undefined
	},
	'billing-checkout': {
		title: 'Checkout',
		description: 'Review pricing and benefits before secure checkout',
		loadingTitle: 'Checkout',
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: undefined
	},
	'billing-checkout-success': {
		title: 'Payment Confirmed',
		description: 'Your upgrade is on the way and syncing now',
		loadingTitle: 'Payment Confirmed',
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: undefined
	},
	'billing-checkout-canceled': {
		title: 'Checkout Paused',
		description: 'No charge was made and your plan is unchanged',
		loadingTitle: 'Checkout Paused',
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: undefined
	},
	settings: {
		title: 'Settings',
		description: 'Manage your account settings and preferences',
		loadingTitle: 'Settings',
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: undefined
	}
} as const
