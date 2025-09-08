import { useMemo } from 'react'

import { useAuth } from '../contexts/auth-context'

/**
 * Permission types for better type safety
 */
export type OrganizationRole = 'owner' | 'admin' | 'member'

export interface PermissionResult {
	canAccess: boolean
	canEdit: boolean
	canDelete: boolean
	canManageSettings: boolean
	canInvite: boolean
	isOwner: boolean
	role: OrganizationRole | null
}

export interface OrganizationPermissions {
	canCreateProjects: boolean
	canEditProjects: boolean
	canDeleteProjects: boolean
	canManageSettings: boolean
	canInviteUsers: boolean
	role: OrganizationRole | null
}

/**
 * Hook to check if user has a specific role in an organization
 */
export const useHasOrganizationRole = (
	organizationId: string,
	requiredRole: OrganizationRole
): boolean => {
	const { organizations } = useAuth()

	return useMemo(() => {
		const membership = organizations.find(
			({ organization }) => organization.id === organizationId
		)?.membership

		if (!membership) return false

		// Role hierarchy: owner > admin > member
		const roleHierarchy = { owner: 3, admin: 2, member: 1 }
		const userRoleLevel =
			roleHierarchy[membership.role as OrganizationRole] || 0
		const requiredRoleLevel = roleHierarchy[requiredRole] || 0

		return userRoleLevel >= requiredRoleLevel
	}, [organizations, organizationId, requiredRole])
}

/**
 * Hook to get user's role in an organization
 */
export const useOrganizationRole = (
	organizationId: string
): OrganizationRole | null => {
	const { organizations } = useAuth()

	return useMemo(() => {
		const membership = organizations.find(
			({ organization }) => organization.id === organizationId
		)?.membership

		return (membership?.role as OrganizationRole) || null
	}, [organizations, organizationId])
}

/**
 * Hook to get all organization permissions for a user
 */
export const useOrganizationPermissions = (
	organizationId: string
): OrganizationPermissions => {
	const { organizations } = useAuth()

	return useMemo(() => {
		const membership = organizations.find(
			({ organization }) => organization.id === organizationId
		)?.membership

		if (!membership) {
			return {
				canCreateProjects: false,
				canEditProjects: false,
				canDeleteProjects: false,
				canManageSettings: false,
				canInviteUsers: false,
				role: null
			}
		}

		const role = membership.role as OrganizationRole
		const isOwner = role === 'owner'
		const isAdmin = role === 'admin'
		const isMember = role === 'member'

		return {
			canCreateProjects: isMember || isAdmin || isOwner,
			canEditProjects: isAdmin || isOwner,
			canDeleteProjects: isOwner,
			canManageSettings: isAdmin || isOwner,
			canInviteUsers: isAdmin || isOwner,
			role
		}
	}, [organizations, organizationId])
}

/**
 * Hook to check project permissions for a given organization
 */
export const useProjectPermissions = (
	organizationId: string
): PermissionResult => {
	const { organizations } = useAuth()

	return useMemo(() => {
		const membership = organizations.find(
			({ organization }) => organization.id === organizationId
		)?.membership

		if (!membership) {
			return {
				canAccess: false,
				canEdit: false,
				canDelete: false,
				canManageSettings: false,
				canInvite: false,
				isOwner: false,
				role: null
			}
		}

		const role = membership.role as OrganizationRole
		const isOwner = role === 'owner'
		const isAdmin = role === 'admin'
		const isMember = role === 'member'

		return {
			canAccess: isMember || isAdmin || isOwner,
			canEdit: isAdmin || isOwner,
			canDelete: isOwner,
			canManageSettings: isAdmin || isOwner,
			canInvite: isAdmin || isOwner,
			isOwner,
			role
		}
	}, [organizations, organizationId])
}

/**
 * Hook to get the user's default organization (primary owned organization)
 */
export const useDefaultOrganization = () => {
	const { organizations } = useAuth()

	return useMemo(() => {
		return (
			organizations.find(({ membership }) => membership.role === 'owner')
				?.organization || null
		)
	}, [organizations])
}

/**
 * Hook to check if user can access a specific project
 */
export const useCanAccessProject = (
	projectId: string,
	organizationId: string
): boolean => {
	const { organizations } = useAuth()

	return useMemo(() => {
		return organizations.some(
			({ organization }) => organization.id === organizationId
		)
	}, [organizations, organizationId])
}

/**
 * Hook to get organizations where user can perform specific actions
 */
export const useOrganizationsWithPermissions = () => {
	const { organizations } = useAuth()

	return useMemo(() => {
		const owned = organizations.filter(
			({ membership }) => membership.role === 'owner'
		)

		const adminOrAbove = organizations.filter(({ membership }) =>
			['admin', 'owner'].includes(membership.role)
		)

		const memberOrAbove = organizations.filter(({ membership }) =>
			['member', 'admin', 'owner'].includes(membership.role)
		)

		return {
			// Organizations where user can create projects
			canCreateProjects: memberOrAbove,
			// Organizations where user can edit projects
			canEditProjects: adminOrAbove,
			// Organizations where user can delete projects
			canDeleteProjects: owned,
			// Organizations where user can invite users
			canInviteUsers: adminOrAbove,
			// Organizations where user can manage settings
			canManageSettings: adminOrAbove,
			// All accessible organizations
			accessible: memberOrAbove
		}
	}, [organizations])
}

/**
 * Hook for bulk operations permissions
 */
export const useBulkPermissions = () => {
	const organizationsWithPermissions = useOrganizationsWithPermissions()

	return useMemo(() => {
		return {
			canBulkCreate: organizationsWithPermissions.canCreateProjects.length > 0,
			canBulkEdit: organizationsWithPermissions.canEditProjects.length > 0,
			canBulkDelete: organizationsWithPermissions.canDeleteProjects.length > 0,
			canBulkInvite: organizationsWithPermissions.canInviteUsers.length > 0,
			organizationsForCreate:
				organizationsWithPermissions.canCreateProjects.map(
					({ organization }) => organization.id
				),
			organizationsForEdit: organizationsWithPermissions.canEditProjects.map(
				({ organization }) => organization.id
			),
			organizationsForDelete:
				organizationsWithPermissions.canDeleteProjects.map(
					({ organization }) => organization.id
				),
			organizationsForInvite: organizationsWithPermissions.canInviteUsers.map(
				({ organization }) => organization.id
			)
		}
	}, [organizationsWithPermissions])
}

/**
 * Hook to get current project context
 */
export const useCurrentProjectContext = () => {
	const { userWithDefaults } = useAuth()
	const defaultOrganization = useDefaultOrganization()

	return useMemo(() => {
		const defaultProject = userWithDefaults?.project || null

		return {
			project: defaultProject,
			organization: defaultOrganization,
			hasContext: !!defaultProject && !!defaultOrganization
		}
	}, [userWithDefaults, defaultOrganization])
}
