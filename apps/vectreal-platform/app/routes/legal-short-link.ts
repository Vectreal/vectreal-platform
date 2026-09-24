import { redirect } from 'react-router'

import { Route } from './+types/legal-short-link'

/**
 * The short addresses people type and link for the legal pages.
 *
 * The pages live at `/privacy-policy` and `/terms-of-service`, and the short
 * forms answered 404 from March 2026 until this route; Search Console listed
 * both. Permanent, so links out in the wild pass their weight to the page.
 *
 * Served here rather than as a Cloudflare page rule: the terraform is applied
 * by hand, so a rule written there is live only once somebody runs it, and
 * this ships with the app and is tested with it.
 */
export const LEGAL_SHORT_LINKS: Record<string, string> = {
	'/privacy': '/privacy-policy',
	'/terms': '/terms-of-service'
}

export function loader({ request }: Route.LoaderArgs) {
	const { pathname, search } = new URL(request.url)
	const target = LEGAL_SHORT_LINKS[pathname.replace(/\/$/, '')]
	if (!target) throw new Response('Not Found', { status: 404 })
	return redirect(`${target}${search}`, 301)
}
