import { ApiResponse } from '@shared/utils'

import {
	NO_INTERNAL_PAGES,
	resolveInternalPages
} from '../../lib/domain/dashboard/internal-pages.server'
import { getAuthUser } from '../../lib/http/auth.server'
import { reportServerError } from '../../lib/observability/report-server-error.server'

import type { Route } from './+types/dashboard.internal-pages'

/*
  Which internal dashboard pages to link, asked by the sidebar after the page
  is on screen. The gates are PostHog flags evaluated over the network, and
  only a few internal accounts pass them, so no page load waits on them.

  An expired session or a failed check answers "nothing open", the same
  answer the sidebar assumes until it hears back, and every page still asks
  its own gate.
*/
export async function loader({ request }: Route.LoaderArgs) {
	const headers = { 'Cache-Control': 'private, no-store' }
	try {
		const authResult = await getAuthUser(request)
		const pages =
			authResult instanceof Response
				? NO_INTERNAL_PAGES
				: await resolveInternalPages(authResult.user)
		return ApiResponse.success(pages, 200, { headers })
	} catch (error) {
		reportServerError(error, { request })
		return ApiResponse.success(NO_INTERNAL_PAGES, 200, { headers })
	}
}
