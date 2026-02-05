import { useMemo } from 'react'

import { usePlatformContext } from '../contexts/platform-context'
import type { organizationMemberships, organizations } from '../db/schema'

export interface OrganizationWithMembership {
	organization: typeof organizations.$inferSelect
	membership: typeof organizationMemberships.$inferSelect
}

/**
 * Hook to get all organizations the user has access to
 */
export const useOrganizations = (): OrganizationWithMembership[] => {
	const { organizations } = usePlatformContext()
	return organizations
}

/**
 * Hook to get a specific organization by ID
 */
export const useOrganization = (
	organizationId: string
): OrganizationWithMembership | null => {
	const { organizations } = usePlatformContext()

	return useMemo(() => {
		return (
			organizations.find(
				({ organization }) => organization.id === organizationId
			) || null
		)
	}, [organizations, organizationId])
}

/**
 * Hook to get organizations grouped by user role
 */
export const useOrganizationsByRole = () => {
	const { organizations } = usePlatformContext()

	return useMemo(() => {
		const owned = organizations.filter(
			({ membership }) => membership.role === 'owner'
		)
		const admin = organizations.filter(
			({ membership }) => membership.role === 'admin'
		)
		const member = organizations.filter(
			({ membership }) => membership.role === 'member'
		)

		return {
			owned,
			admin,
			member,
			all: organizations
		}
	}, [organizations])
}

/**
 * Hook to get organizations filtered by capabilities
 */
export const useOrganizationsByCapability = () => {
	const { organizations } = usePlatformContext()

	return useMemo(() => {
		const canManageSettings = organizations.filter(({ membership }) =>
			['admin', 'owner'].includes(membership.role)
		)

		const canInviteUsers = organizations.filter(({ membership }) =>
			['admin', 'owner'].includes(membership.role)
		)

		const canCreateProjects = organizations.filter(({ membership }) =>
			['member', 'admin', 'owner'].includes(membership.role)
		)

		const canEditProjects = organizations.filter(({ membership }) =>
			['admin', 'owner'].includes(membership.role)
		)

		const canDeleteProjects = organizations.filter(
			({ membership }) => membership.role === 'owner'
		)

		return {
			canManageSettings,
			canInviteUsers,
			canCreateProjects,
			canEditProjects,
			canDeleteProjects
		}
	}, [organizations])
}

/**
 * Hook to get organization statistics
 */
export const useOrganizationStats = () => {
	const { organizations } = usePlatformContext()

	return useMemo(() => {
		const total = organizations.length
		const owned = organizations.filter(
			({ membership }) => membership.role === 'owner'
		).length
		const admin = organizations.filter(
			({ membership }) => membership.role === 'admin'
		).length
		const member = organizations.filter(
			({ membership }) => membership.role === 'member'
		).length

		return {
			total,
			owned,
			admin,
			member,
			hasMultiple: total > 1,
			hasOwned: owned > 0,
			primaryRole: owned > 0 ? 'owner' : admin > 0 ? 'admin' : 'member'
		}
	}, [organizations])
}

/**
 * Hook to get the first organization where user is owner (primary org)
 */
export const usePrimaryOrganization = (): OrganizationWithMembership | null => {
	const { organizations } = usePlatformContext()

	return useMemo(() => {
		return (
			organizations.find(({ membership }) => membership.role === 'owner') ||
			null
		)
	}, [organizations])
}

/**
 * Hook to check if user has access to a specific organization
 */
export const useHasOrganizationAccess = (organizationId: string): boolean => {
	const { organizations } = usePlatformContext()

	return useMemo(() => {
		return organizations.some(
			({ organization }) => organization.id === organizationId
		)
	}, [organizations, organizationId])
}

/**
 * Hook to get organizations sorted by various criteria
 */
export const useSortedOrganizations = () => {
	const { organizations } = usePlatformContext()

	return useMemo(() => {
		const byName = [...organizations].sort((a, b) =>
			a.organization.name.localeCompare(b.organization.name)
		)

		const byRole = [...organizations].sort((a, b) => {
			const roleOrder = { owner: 3, admin: 2, member: 1 }
			return (
				roleOrder[b.membership.role as keyof typeof roleOrder] -
				roleOrder[a.membership.role as keyof typeof roleOrder]
			)
		})

		const byJoinDate = [...organizations].sort(
			(a, b) =>
				new Date(b.membership.joinedAt).getTime() -
				new Date(a.membership.joinedAt).getTime()
		)

		const byCreationDate = [...organizations].sort(
			(a, b) =>
				new Date(b.organization.createdAt).getTime() -
				new Date(a.organization.createdAt).getTime()
		)

		return {
			byName,
			byRole,
			byJoinDate,
			byCreationDate,
			default: organizations // Original order from the server
		}
	}, [organizations])
}

/**
 * Hook to get organizations with search/filter functionality
 */
export const useFilteredOrganizations = (
	searchTerm?: string,
	role?: string
) => {
	const { organizations } = usePlatformContext()

	return useMemo(() => {
		let filtered = organizations

		// Filter by search term
		if (searchTerm) {
			const term = searchTerm.toLowerCase()
			filtered = filtered.filter(({ organization }) =>
				organization.name.toLowerCase().includes(term)
			)
		}

		// Filter by role
		if (role && role !== 'all') {
			filtered = filtered.filter(({ membership }) => membership.role === role)
		}

		return filtered
	}, [organizations, searchTerm, role])
}
