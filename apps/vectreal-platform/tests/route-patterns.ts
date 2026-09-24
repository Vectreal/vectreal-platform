import { matchPath } from 'react-router'

import routes from '../app/routes'

import type { RouteConfigEntry } from '@react-router/dev/routes'

/** Every route pattern in the config, children joined onto their parents. */
function routePatterns(entries: RouteConfigEntry[], parent = ''): string[] {
	return entries.flatMap((entry) => {
		const path = entry.path ? `${parent}/${entry.path}` : parent
		const own = entry.index || entry.path ? [path || '/'] : []
		return [...own, ...routePatterns(entry.children ?? [], path)]
	})
}

// A splat is a not-found page, not a page: it would answer any link under it, broken or not.
const PATTERNS = routePatterns(routes).filter(
	(pattern) => !pattern.endsWith('*')
)

/** Whether the router would answer this path: dynamic and optional segments match the way it matches them. */
export const isRoute = (pathname: string) =>
	PATTERNS.some((pattern) => matchPath({ path: pattern, end: true }, pathname))
