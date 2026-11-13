import { isImgTo3dEnabledFor } from '../img-to-3d/img-to-3d-access.server'
import { isIntakeAdmin } from '../model-intake/model-intake-admin.server'

import type { DashboardInternalPages } from './dashboard-types'
import type { User } from '@supabase/supabase-js'

export const NO_INTERNAL_PAGES: DashboardInternalPages = {
	generations: false,
	intake: false
}

/**
 * The internal pages `user` may open, each answered by that page's own gate,
 * so the sidebar never links to a page that would answer 404. Neither gate
 * throws: anything but a yes is a no.
 */
export async function resolveInternalPages(
	user: User
): Promise<DashboardInternalPages> {
	const [generations, intake] = await Promise.all([
		isImgTo3dEnabledFor(user),
		isIntakeAdmin(user)
	])
	return { generations, intake }
}
