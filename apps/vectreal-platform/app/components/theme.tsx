import { useEffect } from 'react'
import { useLocation } from 'react-router'

import {
	readThemeCookie,
	THEME_COOKIE_NAME,
	type ThemeMode
} from '../lib/theme/theme-cookie'

/** Routes that always render dark regardless of the visitor's preference. */
export function isForceDarkRoute(pathname: string): boolean {
	return pathname === '/' || pathname === '/home'
}

function resolveIsDark(mode: ThemeMode, forceDark: boolean): boolean {
	if (forceDark || mode === 'dark') return true
	if (mode === 'system' && typeof window !== 'undefined') {
		return window.matchMedia('(prefers-color-scheme: dark)').matches
	}
	return false
}

/** Apply a theme to the document root. Safe to call on the client only. */
export function applyTheme(mode: ThemeMode, forceDark: boolean): void {
	if (typeof document === 'undefined') return
	const isDark = resolveIsDark(mode, forceDark)
	const root = document.documentElement
	root.classList.toggle('dark', isDark)
	root.style.colorScheme = isDark ? 'dark' : 'light'
}

/**
 * Blocking pre-paint script that applies the visitor's own cookie theme before
 * first paint. Because it reads document.cookie at load time (not a value baked
 * into the HTML), CDN-cached anonymous HTML still renders each visitor's own
 * theme with no flash. `forceDark` is route-derived, so it is cache-safe to
 * embed as a literal.
 */
export function ThemeScript({ forceDark }: { forceDark: boolean }) {
	const script = `(() => {
  const root = document.documentElement;
  const forceDark = ${JSON.stringify(forceDark)};
  const match = document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE_NAME}=([^;]*)/);
  const mode = match ? decodeURIComponent(match[1]) : 'system';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = forceDark || mode === 'dark' || (mode === 'system' && prefersDark);
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
})();`

	return <script dangerouslySetInnerHTML={{ __html: script }} />
}

/**
 * Post-hydration controller: re-applies the cookie theme on route change (so
 * force-dark routes toggle correctly) and follows the OS setting while in
 * `system` mode.
 */
export function ThemeController() {
	const { pathname } = useLocation()

	useEffect(() => {
		const forceDark = isForceDarkRoute(pathname)
		const mode = readThemeCookie()
		applyTheme(mode, forceDark)

		if (forceDark || mode !== 'system') {
			return
		}

		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
		const handleChange = () => applyTheme('system', false)
		mediaQuery.addEventListener('change', handleChange)

		return () => mediaQuery.removeEventListener('change', handleChange)
	}, [pathname])

	return null
}
