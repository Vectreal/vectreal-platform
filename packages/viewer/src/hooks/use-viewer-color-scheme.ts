import { useSyncExternalStore } from 'react'

export type ViewerTheme = 'light' | 'dark' | 'system'
export type ViewerColorScheme = 'light' | 'dark'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * The scheme a viewer draws in: the one it was given, or the visitor's own when
 * it was told to follow the system.
 */
export function resolveViewerColorScheme(
	theme: ViewerTheme,
	prefersDark: boolean
): ViewerColorScheme {
	if (theme === 'system') return prefersDark ? 'dark' : 'light'
	return theme
}

const subscribe = (onChange: () => void) => {
	const query = window.matchMedia(DARK_QUERY)
	query.addEventListener('change', onChange)
	return () => query.removeEventListener('change', onChange)
}

const prefersDark = () => window.matchMedia(DARK_QUERY).matches

/**
 * The viewer's scheme, as the `light` or `dark` class its root carries.
 *
 * A class rather than the page's: the shared palette (`theme.css`) is keyed to
 * a subtree, so a viewer can follow its own setting inside a page that uses the
 * other one. The server snapshot is light; the viewer only renders on the
 * client, so a hydrating host never sees it.
 */
export function useViewerColorScheme(theme: ViewerTheme): ViewerColorScheme {
	const dark = useSyncExternalStore(subscribe, prefersDark, () => false)
	return resolveViewerColorScheme(theme, dark)
}
