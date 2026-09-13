import type { scenes } from '../../../db/schema'

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
 *
 * `computeOrganizationStats` went the same way, for a different reason: the
 * organizations index counted its own list in three cards sitting directly
 * above that list, and counting a list rendered beneath you is not a second
 * fact. Nothing else ever called it.
 */
