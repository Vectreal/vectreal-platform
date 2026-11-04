import { redirect } from 'react-router'

import { followIntakeShortLink } from '../lib/domain/model-intake/model-intake-letter.server'

import type { Route } from './+types/letter-short-link'

/**
 * The address a letter's QR code encodes and its card prints, `/c/<code>`.
 * Temporary and never cached: where a code leads changes once the sample
 * store has a page for its category, and every visit is a scan to count.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
	return redirect(await followIntakeShortLink(request, params.code), {
		status: 302,
		headers: { 'Cache-Control': 'no-store' }
	})
}
