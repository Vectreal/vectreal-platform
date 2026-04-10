import type {
	OrganizationStats,
	ProjectStats,
	SceneStats
} from './dashboard-stats.server'
import type { Plan, BillingState } from '../../../constants/plan-config'
import type {
	organizationMemberships,
	organizations,
	projects,
	sceneFolders,
	scenes,
	users
} from '../../../db/schema'
import type { UserWithDefaults } from '../user/user-repository.server'
import type { User } from '@supabase/supabase-js'

/**
 * Organization with membership info
 */
export interface OrganizationWithMembership {
	organization: typeof organizations.$inferSelect
	membership: typeof organizationMemberships.$inferSelect
}

/**
 * Project with organization ID
 */
export interface ProjectWithOrganization {
	project: typeof projects.$inferSelect
	organizationId: string
}

/**
 * Loader data for dashboard index page
 */
export interface DashboardLoaderData {
	user: User
	userWithDefaults: UserWithDefaults
	organizations: OrganizationWithMembership[]
	projects: ProjectWithOrganization[]
	scenes: Array<typeof scenes.$inferSelect>
	projectStats: ProjectStats
	sceneStats: SceneStats
	recentProjects: ProjectWithOrganization[]
	recentScenes: Array<typeof scenes.$inferSelect>
}

/**
 * Loader data for organizations page
 */
export interface OrganizationsLoaderData {
	user: User
	userWithDefaults: UserWithDefaults
	organizations: OrganizationWithMembership[]
	organizationStats: OrganizationStats
}

export interface OrganizationMemberWithUser {
	membership: typeof organizationMemberships.$inferSelect
	user: Pick<typeof users.$inferSelect, 'id' | 'email' | 'name'>
}

export interface OrganizationDetailLoaderData {
	user: User
	userWithDefaults: UserWithDefaults
	organization: typeof organizations.$inferSelect
	membership: typeof organizationMemberships.$inferSelect
	members: OrganizationMemberWithUser[]
	projectsTotal: number
	billing: {
		plan: Plan
		billingState: BillingState
	}
	entitlements: {
		orgMultiMember: boolean
		orgRoles: boolean
	}
	isReadOnlyBillingState: boolean
}

/**
 * Loader data for projects page
 */
export interface ProjectsLoaderData {
	user: User
	userWithDefaults: UserWithDefaults
	organizations: OrganizationWithMembership[]
	projects: ProjectWithOrganization[]
	scenes: Array<typeof scenes.$inferSelect>
	projectCreationCapabilities: Record<
		string,
		{
			canCreate: boolean
			canEdit: boolean
			canDelete: boolean
			projectsTotal: number
			projectsLimit: number | null
			quotaExceeded: boolean
			plan: Plan | null
			upgradeTo: Plan | null
		}
	>
	sceneStats: SceneStats
}

/**
 * Loader data for project detail page
 */
export interface ProjectLoaderData {
	user: User
	userWithDefaults: UserWithDefaults
	project: typeof projects.$inferSelect
	folders: Array<typeof sceneFolders.$inferSelect>
	scenes: Array<typeof scenes.$inferSelect>
	organization: OrganizationWithMembership | null
}

/**
 * Loader data for folder page
 */
export interface FolderLoaderData {
	user: User
	userWithDefaults: UserWithDefaults
	project: typeof projects.$inferSelect
	folder: typeof sceneFolders.$inferSelect
	folderPath: Array<typeof sceneFolders.$inferSelect>
	subfolders: Array<typeof sceneFolders.$inferSelect>
	scenes: Array<typeof scenes.$inferSelect>
	organization: OrganizationWithMembership | null
}

/**
 * Loader data for scene page
 */
export interface SceneLoaderData {
	user: User
	userWithDefaults: UserWithDefaults
	project: typeof projects.$inferSelect
	scene: typeof scenes.$inferSelect
	folderPath: Array<typeof sceneFolders.$inferSelect>
	organization: OrganizationWithMembership | null
}

/**
 * Loader data for settings page
 */
export interface SettingsLoaderData {
	user: User
	userWithDefaults: UserWithDefaults
	themeMode: 'system' | 'light' | 'dark'
}

/**
 * Billing data surfaced on the settings page
 */
export interface BillingSettingsData {
	plan: Plan
	billingState: BillingState
	currentPeriodEnd: string | null
	trialEnd: string | null
	hasStripeCustomer: boolean
	usage: {
		scenesTotal: number
		sceneLimit: number | null
		publishedScenes: number
		publishedSceneLimit: number | null
		optimizationRuns: number
		optimizationLimit: number | null
		projectsTotal: number
		projectsLimit: number | null
		apiRequestsMonth: number
		apiRequestsMonthLimit: number | null
		storageBytesTotal: number
		storageLimit: number | null
		embedBandwidthMonth: number
		embedBandwidthLimit: number | null
		previewLoadsMonth: number
		previewLoadsMonthLimit: number | null
	}
}

export interface BillingCheckoutOptions {
	pro: BillingCheckoutPeriods
	business: BillingCheckoutPeriods
}

export interface BillingCheckoutOption {
	priceId: string
	amountCents: number
	currency: string
	interval: 'month' | 'year'
	intervalCount: number
	productName: string | null
}

export interface BillingCheckoutPeriods {
	monthly: BillingCheckoutOption | null
	annual: BillingCheckoutOption | null
}

export interface BillingLoaderData {
	user: User
	userWithDefaults: UserWithDefaults
	billing: BillingSettingsData
	checkoutOptions?: BillingCheckoutOptions
}

/**
 * Loader data for new project page
 */
export interface ProjectNewLoaderData {
	user: User
	userWithDefaults: UserWithDefaults
	organizations: OrganizationWithMembership[]
	projectCreationCapabilities: Record<
		string,
		{
			canCreate: boolean
			canEdit: boolean
			canDelete: boolean
			projectsTotal: number
			projectsLimit: number | null
			quotaExceeded: boolean
			plan: Plan | null
			upgradeTo: Plan | null
		}
	>
}
