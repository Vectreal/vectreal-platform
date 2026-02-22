import type {
	OrganizationStats,
	ProjectStats,
	SceneStats
} from './dashboard-stats.server'
import type {
	organizationMemberships,
	organizations,
	projects,
	sceneFolders,
	scenes
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
	organization: OrganizationWithMembership | null
}

/**
 * Loader data for settings page
 */
export interface SettingsLoaderData {
	user: User
	userWithDefaults: UserWithDefaults
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
		}
	>
}
