import type { User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

import type {
	organizationMemberships,
	organizations,
	projects
} from '../db/schema'
import type { UserWithDefaults } from '../lib/services/user.service'

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
