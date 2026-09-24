import { useEffect } from 'react'
import { useLocation } from 'react-router'

import {
	readThemeCookie,
	THEME_COOKIE_NAME,
	type ThemeMode
} from '../lib/theme/theme-cookie'

/*
  Every route follows the visitor's theme. The home page used to force dark,
  back when its surfaces were built for dark only; the rebuilt page is
  designed in both.
*/

function resolveIsDark(mode: ThemeMode): boolean {
	if (mode === 'dark') return true
	if (mode === 'system' && typeof window !== 'undefined') {
		return window.matchMedia('(prefers-color-scheme: dark)').matches
	}
	return false
}

/** Apply a theme to the document root. Safe to call on the client only. */
export function applyTheme(mode: ThemeMode): void {
	if (typeof document === 'undefined') return
	const isDark = resolveIsDark(mode)
	const root = document.documentElement
	root.classList.toggle('dark', isDark)
	root.style.colorScheme = isDark ? 'dark' : 'light'
}

/**
 * Blocking pre-paint script that applies the visitor's own cookie theme before
 * first paint. Because it reads document.cookie at load time (not a value baked
 * into the HTML), CDN-cached anonymous HTML still renders each visitor's own
 * theme with no flash.
 */
export function ThemeScript() {
	const script = `(() => {
  const root = document.documentElement;
  const match = document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE_NAME}=([^;]*)/);
  const mode = match ? decodeURIComponent(match[1]) : 'system';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
})();`

	return <script dangerouslySetInnerHTML={{ __html: script }} />
}

/**
 * Post-hydration controller: re-reads the cookie theme on route change, since
 * a toggle elsewhere may have written it, and follows the OS setting while in
 * `system` mode.
 */
export function ThemeController() {
	const { pathname } = useLocation()

	useEffect(() => {
		const mode = readThemeCookie()
		applyTheme(mode)

		if (mode !== 'system') {
			return
		}

		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
		const handleChange = () => applyTheme('system')
		mediaQuery.addEventListener('change', handleChange)

		return () => mediaQuery.removeEventListener('change', handleChange)
	}, [pathname])

	return null
}
