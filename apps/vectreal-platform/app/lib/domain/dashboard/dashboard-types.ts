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
 * The signed-in person, as the dashboard chrome draws them.
 *
 * Four fields, because four are read: the sidebar wants a name, an avatar and
 * an initial, and PostHog wants an id and an email. The layout used to ship the
 * whole Supabase `User`, and a layout's payload is serialized into every route
 * beneath it - so `identities`, `app_metadata`, `user_metadata`,
 * `email_confirmed_at` and `aud` reached the browser on every page of the
 * dashboard, for two readers that wanted a name and an id.
 *
 * `name` is resolved on the server rather than at the two call sites that each
 * spelled the `full_name ?? name ?? email` fallback by hand.
 */
export interface DashboardActor {
	id: string
	email: string | null
	name: string
	avatarUrl: string | null
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
}

/**
 * What an organization is consuming, against what its plan allows.
 *
 * Read by `/dashboard/usage` and by nothing else. It used to be a member of
 * `BillingSettingsData`, which put five counting queries on the billing page's
 * critical path for readings that page no longer renders.
 */
/**
 * One project's share of what the organization is consuming.
 *
 * `lastChangedAt` is the newest `updatedAt` across the project's scenes, and is
 * null for a project that holds none - which reads as "never" rather than as
 * today's date, the mistake `ProjectRow` documents having made.
 */
export interface ProjectUsage {
	id: string
	name: string
	storageBytes: number
	sceneCount: number
	lastChangedAt: string | null
}

/** Storage grouped by what kind of file it is. */
export interface AssetTypeUsage {
	type: 'texture' | 'material' | 'model' | 'environment' | 'other'
	storageBytes: number
	fileCount: number
}

/**
 * One scene and what it costs to load.
 *
 * `storageBytes` is what the scene references, not what it exclusively owns:
 * `scene_assets` is many-to-many so a shared texture counts against every scene
 * using it. These therefore do not sum to the organization's storage total,
 * which counts each asset once.
 */
export interface HeaviestScene {
	id: string
	name: string
	projectId: string
	projectName: string
	storageBytes: number
	assetCount: number
	updatedAt: string
}

/** One heavy file, with enough to find it again. */
export interface LargestAsset {
	id: string
	name: string
	type: AssetTypeUsage['type']
	storageBytes: number
	projectId: string
	projectName: string
}

export interface OrgUsage {
	scenesTotal: number
	sceneLimit: number | null
	publishedScenes: number
	publishedSceneLimit: number | null
	projectsTotal: number
	projectsLimit: number | null
	foldersTotal: number
	foldersLimit: number | null
	storageBytesTotal: number
	storageLimit: number | null
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
	billing: BillingSettingsData
	checkoutOptions?: BillingCheckoutOptions
}
