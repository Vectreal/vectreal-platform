/**
 * Dashboard Layout Types
 * @description Type definitions for the dashboard layout components
 */

import type {
	BillingLoaderData,
	FolderLoaderData,
	OrganizationDetailLoaderData,
	ProjectLoaderData,
	SceneLoaderData
} from '../lib/domain/dashboard/dashboard-types'
import type { ReactNode } from 'react'

export enum ACTION_VARIANT {
	CREATE_PROJECT = 'create-project',
	PROJECT_LIST = 'projects-list',
	API_KEYS_LIST = 'api-keys-list',
	PROJECT_DETAIL = 'project-detail',
	FOLDER_DETAIL = 'folder-detail',
	SCENE_DETAIL = 'scene-detail',
	DASHBOARD = 'dashboard',
	ORG_LIST = 'organizations-list'
}

export type DashboardView =
	| 'projects'
	| 'api-keys'
	| 'organizations'
	| 'usage'
	| 'billing'
	| 'settings'
	| 'dashboard'

/**
 * Route context discriminated union for type-safe routing
 */
export type RouteContext =
	| 'dashboard'
	| 'project-list'
	| 'api-keys'
	| 'project-detail'
	| 'folder-detail'
	| 'scene-detail'
	| 'organizations'
	| 'organization-detail'
	| 'usage'
	| 'billing'
	| 'billing-checkout'
	| 'billing-checkout-success'
	| 'billing-checkout-canceled'
	| 'settings'

/**
 * Navigation state passed through React Router
 */
export interface NavigationState {
	name?: string
	description?: string
	projectName?: string
	type?: 'scene' | 'folder' | 'project'
}

export interface TitleContent {
	title: string
	description?: string
}

/**
 * Configuration for dashboard content with loading states
 */
/*
	`description` is optional because some pages answer themselves.

	It was required, so every route had to supply one, and four of them paid the
	tax in words: "Project details" under Project, "Folder contents" under
	Folder, "Scene details" under Scene. A subtitle that restates its own title
	is read first and says nothing, and on a phone it costs two lines above the
	content. A required field cannot express "this page needs no gloss", so it
	got filled with noise instead.
*/
export interface DashboardContentConfig {
	title: string
	description?: string
	actionVariant?: ACTION_VARIANT
}

export interface DynamicHeaderContent {
	title: string | ReactNode
	description?: string | ReactNode
	actionVariant?: ACTION_VARIANT
	breadcrumbs?: BreadcrumbItem[]
}

export interface RouteParams {
	view: DashboardView
	projectId?: string
	routeType?: string
	routeId?: string
}

/**
 * Typed result from route data extraction
 */
export interface RouteDataResult {
	project?: ProjectLoaderData
	folder?: FolderLoaderData
	scene?: SceneLoaderData
	organizationDetail?: OrganizationDetailLoaderData
	usage?: UsageLoaderData
	/*
	  The billing loader's own type, not a narrowed copy of it the way
	  `UsageLoaderData` above is. It already exists and already says
	  `billing: BillingSettingsData`; declaring a second interface of the same
	  name in this file gave two types one name for no gain.

	  The header turns those four fields into the page's one line itself, rather
	  than the loader shipping a verdict as usage does: usage computes one from
	  five readings it had to query anyway, and this is a pure function over
	  data the loader already returns.
	*/
	billing?: BillingLoaderData
}

/** Only the part of the usage loader the header reads. */
export interface UsageLoaderData {
	verdict: { headline: string }
}

/**
 * Breadcrumb item for navigation
 */
export interface BreadcrumbItem {
	label: string
	to?: string
	isLast?: boolean
}

/**
 * One row of the scene detail asset list.
 *
 * Declared in the scene route until the detail surfaces were extracted, which
 * left `scene-asset-list-item.tsx` importing a type from a route module - so a
 * component could not be read, tested or moved without the route it happened to
 * be born in.
 */
export interface SceneAssetSummary {
	id: string
	name: string
	type: string
	fileSize: number | null
	mimeType: string | null
}

/** Everything the "what this scene is" surface renders, as the loader ships it. */
export interface SceneDetailsSummary {
	fileSizeBytes: number | null
	assetCount: number
	textureBytes: number | null
	textureCount: number | null
	meshesCount: number | null
	verticesCount: number | null
	assets: SceneAssetSummary[]
}
