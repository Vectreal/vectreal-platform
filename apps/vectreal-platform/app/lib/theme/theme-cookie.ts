import { buildSetCookie, readClientCookie, readRawCookie } from '../http/cookies'

export const THEME_COOKIE_NAME = 'theming'
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 1 week

export type ThemeMode = 'system' | 'light' | 'dark'

/**
 * Isomorphic theme-preference cookie, matching the consent cookie approach: a
 * plain, client-readable, unsigned cookie. The client reads it before first
 * paint, so the preference never has to be baked into CDN-cached HTML (which is
 * shared across visitors) and it survives app-secret rotation on deploy.
 */

export function isThemeMode(value: unknown): value is ThemeMode {
	return value === 'system' || value === 'light' || value === 'dark'
}

function decode(raw: string | null): ThemeMode {
	if (!raw) return 'system'
	const value = decodeURIComponent(raw)
	return isThemeMode(value) ? value : 'system'
}

/** Server only: read the theme preference from a Cookie header. */
export function parseThemeCookieHeader(cookieHeader: string | null): ThemeMode {
	return decode(readRawCookie(cookieHeader, THEME_COOKIE_NAME))
}

/** Client only: read the theme preference from document.cookie. */
export function readThemeCookie(): ThemeMode {
	return decode(readClientCookie(THEME_COOKIE_NAME))
}

/** Server only: build the Set-Cookie header value for the theme preference. */
export function buildThemeSetCookie(mode: ThemeMode): string {
	return buildSetCookie(
		THEME_COOKIE_NAME,
		encodeURIComponent(mode),
		THEME_COOKIE_MAX_AGE
	)
}
