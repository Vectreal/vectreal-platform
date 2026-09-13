import type {
	organizationMemberships,
	organizations,
	scenes
} from '../../../db/schema'

export interface OrganizationStats {
	total: number
	owned: number
	admin: number
}

/**
 * Computes organization statistics from organization data.
 */
export function computeOrganizationStats(
	userOrganizations: Array<{
		organization: typeof organizations.$inferSelect
		membership: typeof organizationMemberships.$inferSelect
	}>
): OrganizationStats {
	let owned = 0
	let admin = 0

	for (const { membership } of userOrganizations) {
		switch (membership.role) {
			case 'owner':
				owned++
				break
			case 'admin':
				admin++
				break
		}
	}

	return {
		total: userOrganizations.length,
		owned,
		admin
	}
}

/**
 * Gets the most recent scenes (by updatedAt).
 */
export function getRecentScenes(
	allScenes: Array<typeof scenes.$inferSelect>,
	limit = 5
): Array<typeof scenes.$inferSelect> {
	return [...allScenes]
		.sort(
			(a, b) =>
				new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
		)
		.slice(0, limit)
}

/*
 * Project capability predicates used to live here. They now come from
 * `buildDashboardCapabilities` in `./dashboard-capabilities`, which derives
 * them from the shared permission table rather than restating the rules - and,
 * being client-safe, can be read by the components that gate on them.
 */
