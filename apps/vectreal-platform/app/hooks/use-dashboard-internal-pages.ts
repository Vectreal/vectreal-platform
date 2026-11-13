import { useEffect, useState } from 'react'

import type { DashboardInternalPages } from '../lib/domain/dashboard/dashboard-types'

export const DASHBOARD_INTERNAL_PAGES_URL = '/api/dashboard/internal-pages'

const NONE: DashboardInternalPages = { generations: false, intake: false }

/**
 * The internal pages this user may open, asked once the dashboard is on
 * screen rather than in its loader: the gates are PostHog flags evaluated over
 * the network, and no page load waits on them. Until they answer, and if the
 * request fails for any reason, every page reads as closed, so a link only
 * ever appears.
 *
 * A plain `fetch`, not a fetcher: a fetcher renders a failed request (a 502
 * during a deploy, a dropped connection) in the route's error boundary, which
 * would replace the dashboard over a sidebar link. Called by the layout, which
 * stays mounted, so the mobile sidebar sheet opening and closing asks nothing.
 */
export function useDashboardInternalPages(): DashboardInternalPages {
	const [pages, setPages] = useState(NONE)

	useEffect(() => {
		const controller = new AbortController()
		fetch(DASHBOARD_INTERNAL_PAGES_URL, { signal: controller.signal })
			.then((response) => (response.ok ? response.json() : null))
			.then((body: { success?: boolean; data?: DashboardInternalPages }) => {
				if (body?.success && body.data) setPages(body.data)
			})
			.catch(() => {
				// Aborted or failed: the links stay out, and each page still asks its gate.
			})
		return () => controller.abort()
	}, [])

	return pages
}
