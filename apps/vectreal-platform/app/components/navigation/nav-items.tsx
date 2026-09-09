import { BookOpen, DollarSign, Mail, Newspaper } from 'lucide-react'

import type { NavItem } from './types'

/*
  The marketing nav, and only marketing.

  The publisher was in here, and it is the application rather than a page about
  the product - so the nav's own list of pages offered a signed-out visitor a
  tool instead of the case for using it. It stays reachable where the funnel
  actually runs: the "Get Started" call to action both navs still render beside
  this list while signed out, the home hero, the footer's product column, and
  the user menu once someone is signed in.
*/
export const MARKETING_ITEMS: NavItem[] = [
	{
		label: 'Pricing',
		to: '/pricing',
		icon: <DollarSign className="size-4" />
	},
	{
		label: 'Documentation',
		to: '/docs',
		icon: <BookOpen className="size-4" />
	},
	{
		label: 'Newsroom',
		to: '/news-room',
		icon: <Newspaper className="size-4" />
	},
	{
		label: 'Contact',
		to: '/contact',
		icon: <Mail className="size-4" />
	}
]

/**
 * Home is matched exactly because it would otherwise prefix-match every path.
 * `/home` is the same page for signed-in visitors, so both spellings count.
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
	if (item.to === '/') {
		return pathname === '/' || pathname === '/home'
	}

	return pathname.startsWith(item.to)
}
