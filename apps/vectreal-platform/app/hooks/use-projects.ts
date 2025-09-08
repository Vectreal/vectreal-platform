import { useMemo } from 'react'

import { useAuth } from '../contexts/auth-context'
import type { projects } from '../db/schema'

export interface ProjectWithOrganization {
	project: typeof projects.$inferSelect
	organizationId: string
}

/**
 * Hook to get all projects the user has access to
 */
export const useProjects = (): ProjectWithOrganization[] => {
	const { projects } = useAuth()
	return projects
}

/**
 * Hook to get a specific project by ID
 */
export const useProject = (
	projectId: string
): ProjectWithOrganization | null => {
	const { projects } = useAuth()

	return useMemo(() => {
		return projects.find(({ project }) => project.id === projectId) || null
	}, [projects, projectId])
}

/**
 * Hook to get projects for a specific organization
 */
export const useOrganizationProjects = (
	organizationId: string
): ProjectWithOrganization[] => {
	const { projects } = useAuth()

	return useMemo(() => {
		return projects.filter(
			({ organizationId: projOrgId }) => projOrgId === organizationId
		)
	}, [projects, organizationId])
}

/**
 * Hook to get projects grouped by organization
 */
export const useProjectsByOrganization = () => {
	const { projects, organizations } = useAuth()

	return useMemo(() => {
		const grouped = new Map<
			string,
			{
				organization: (typeof organizations)[0]['organization']
				projects: ProjectWithOrganization[]
			}
		>()

		// Initialize with all organizations
		organizations.forEach(({ organization }) => {
			grouped.set(organization.id, {
				organization,
				projects: []
			})
		})

		// Group projects by organization
		projects.forEach((projectWithOrg) => {
			const existing = grouped.get(projectWithOrg.organizationId)
			if (existing) {
				existing.projects.push(projectWithOrg)
			}
		})

		return Array.from(grouped.values())
	}, [projects, organizations])
}

/**
 * Hook to get project statistics
 */
export const useProjectStats = () => {
	const { projects } = useAuth()

	return useMemo(() => {
		const total = projects.length
		const byOrganization = new Map<string, number>()

		projects.forEach(({ organizationId }) => {
			byOrganization.set(
				organizationId,
				(byOrganization.get(organizationId) || 0) + 1
			)
		})

		return {
			total,
			byOrganization: Object.fromEntries(byOrganization),
			hasProjects: total > 0,
			hasMultipleProjects: total > 1
		}
	}, [projects])
}

/**
 * Hook to get projects sorted by various criteria
 */
export const useSortedProjects = () => {
	const { projects } = useAuth()

	return useMemo(() => {
		const byName = [...projects].sort((a, b) =>
			a.project.name.localeCompare(b.project.name)
		)

		const bySlug = [...projects].sort((a, b) =>
			a.project.slug.localeCompare(b.project.slug)
		)

		return {
			byName,
			bySlug,
			default: projects // Original order from the server
		}
	}, [projects])
}

/**
 * Hook to get projects with search/filter functionality
 */
export const useFilteredProjects = (
	searchTerm?: string,
	organizationId?: string
) => {
	const { projects } = useAuth()

	return useMemo(() => {
		let filtered = projects

		// Filter by search term
		if (searchTerm) {
			const term = searchTerm.toLowerCase()
			filtered = filtered.filter(
				({ project }) =>
					project.name.toLowerCase().includes(term) ||
					project.slug.toLowerCase().includes(term)
			)
		}

		// Filter by organization
		if (organizationId && organizationId !== 'all') {
			filtered = filtered.filter(
				({ organizationId: projOrgId }) => projOrgId === organizationId
			)
		}

		return filtered
	}, [projects, searchTerm, organizationId])
}

/**
 * Hook to get the user's default/primary project
 */
export const useDefaultProject = (): typeof projects.$inferSelect | null => {
	const { userWithDefaults } = useAuth()

	return useMemo(() => {
		return userWithDefaults?.project || null
	}, [userWithDefaults])
}

/**
 * Hook to check if user has access to a specific project
 */
export const useHasProjectAccess = (projectId: string): boolean => {
	const { projects } = useAuth()

	return useMemo(() => {
		return projects.some(({ project }) => project.id === projectId)
	}, [projects, projectId])
}

/**
 * Hook to get recent projects (by name for now, since no timestamps)
 */
export const useRecentProjects = (limit = 5): ProjectWithOrganization[] => {
	const { projects } = useAuth()

	return useMemo(() => {
		return [...projects]
			.sort((a, b) => a.project.name.localeCompare(b.project.name))
			.slice(0, limit)
	}, [projects, limit])
}

/**
 * Hook to get projects with additional organization context
 */
export const useProjectsWithContext = () => {
	const { projects, organizations } = useAuth()

	return useMemo(() => {
		return projects.map((projectWithOrg) => {
			const organizationWithMembership = organizations.find(
				({ organization }) => organization.id === projectWithOrg.organizationId
			)

			return {
				...projectWithOrg,
				organization: organizationWithMembership?.organization || null,
				membership: organizationWithMembership?.membership || null
			}
		})
	}, [projects, organizations])
}

/**
 * Hook for project creation capabilities based on user's organizations
 */
export const useProjectCreationCapabilities = () => {
	const { organizations } = useAuth()

	return useMemo(() => {
		const organizationsForCreation = organizations.filter(({ membership }) =>
			['member', 'admin', 'owner'].includes(membership.role)
		)

		const defaultOrganization = organizations.find(
			({ membership }) => membership.role === 'owner'
		)?.organization

		return {
			canCreateProjects: organizationsForCreation.length > 0,
			availableOrganizations: organizationsForCreation.map(
				({ organization, membership }) => ({
					...organization,
					role: membership.role
				})
			),
			defaultOrganization,
			hasMultipleOrganizations: organizationsForCreation.length > 1
		}
	}, [organizations])
}
