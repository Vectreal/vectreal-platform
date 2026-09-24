import type { SiteLink } from '../../lib/navigation/site-map'

/*
  What the nav links to lives in the site map (`lib/navigation/site-map.ts`),
  which the drawer and the footer read too. This file keeps only the rule for
  which of those links is the page the reader is on.
*/

/**
 * Home is matched exactly because it would otherwise prefix-match every path.
 * `/home` is the same page for signed-in visitors, so both spellings count.
 * Anything else matches its own path and the paths under it, by whole segment.
 * A link with a query, like the pilot's, never matches: a pathname has none.
 */
export function isNavItemActive(
	item: Pick<SiteLink, 'to'>,
	pathname: string
): boolean {
	if (item.to === '/') {
		return pathname === '/' || pathname === '/home'
	}

	return pathname === item.to || pathname.startsWith(`${item.to}/`)
}
