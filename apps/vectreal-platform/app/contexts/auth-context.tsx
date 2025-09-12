import type { User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

import type {
	organizationMemberships,
	organizations,
	projects,
	sceneFolders,
	scenes
} from '../db/schema'
import type { UserWithDefaults } from '../lib/services/user-service.server'

/**
 * Authentication Context
 *
 * This context provides core user authentication data.
 * Use specialized hooks in the hooks directory for permissions and data manipulation.
 *
 * Available Basic Hooks:
 * - useAuth() - Get complete auth context
 * - useCurrentUser() - Get Supabase user object
 * - useUserWithDefaults() - Get initialized user with default org/project
 * - useUserOrganizations() - Get all user's organization memberships
 * - useUserProjects() - Get all user's accessible projects
 * - useUserScenes() - Get all user's accessible scenes
 * - useUserSceneFolders() - Get all user's accessible scene folders
 */

export interface AuthContextType {
	user: User
	userWithDefaults: UserWithDefaults | null
	organizations: Array<{
		organization: typeof organizations.$inferSelect
		membership: typeof organizationMemberships.$inferSelect
	}>
	projects: Array<{
		project: typeof projects.$inferSelect
		organizationId: string
	}>
	scenes: Array<{
		scene: typeof scenes.$inferSelect
		projectId: string
	}>
	sceneFolders: Array<{
		folder: typeof sceneFolders.$inferSelect
		projectId: string
	}>
	error?: string
}

export const AuthContext = createContext<AuthContextType | null>(null)

export const useAuth = () => {
	const context = useContext(AuthContext)
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider')
	}
	return context
}

export const useCurrentUser = () => {
	const { user } = useAuth()
	return user
}

export const useUserWithDefaults = () => {
	const { userWithDefaults } = useAuth()
	return userWithDefaults
}

export const useUserOrganizations = () => {
	const { organizations } = useAuth()
	return organizations
}

export const useUserProjects = () => {
	const { projects } = useAuth()
	return projects
}

export const useUserScenes = () => {
	const { scenes } = useAuth()
	return scenes
}

export const useUserSceneFolders = () => {
	const { sceneFolders } = useAuth()
	return sceneFolders
}
