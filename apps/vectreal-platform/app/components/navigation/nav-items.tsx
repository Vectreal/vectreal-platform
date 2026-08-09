import { BookOpen, DollarSign, Mail, Newspaper, Rocket } from 'lucide-react'

import type { NavItem } from './types'

export const MARKETING_ITEMS: NavItem[] = [
	{
		label: 'Publisher',
		to: '/publisher',
		icon: <Rocket className="size-4" />
	},
	{
		label: 'Pricing',
		to: '/pricing',
		icon: <DollarSign className="size-4" />
	},
	{ label: 'Docs', to: '/docs', icon: <BookOpen className="size-4" /> },
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
