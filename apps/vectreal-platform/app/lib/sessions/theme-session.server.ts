import { createCookieSessionStorage } from 'react-router'

export const THEME_COOKIE_NAME = 'theming'
export type ThemeMode = 'system' | 'light' | 'dark'

type SessionData = {
	themeMode?: ThemeMode
}

type SessionFlashData = {
	error: string
}

const themeSecret = process.env.CSRF_SECRET ?? process.env.SESSION_SECRET
if (!themeSecret && process.env.NODE_ENV === 'production') {
	throw new Error('Theme cookie session secret is required in production')
}

const resolvedSessionSecret = themeSecret || 'dev-only-theme-session-secret'

const { getSession, commitSession, destroySession } =
	createCookieSessionStorage<SessionData, SessionFlashData>({
		// a Cookie from `createCookie` or the CookieOptions to create one
		cookie: {
			name: THEME_COOKIE_NAME,

			// Expires can also be set (although maxAge overrides it when used in combination).
			// Note that this method is NOT recommended as `new Date` creates only one date on each server deployment, not a dynamic date in the future!
			//
			// expires: new Date(Date.now() + 60_000),
			httpOnly: true,
			maxAge: 60 * 60 * 24 * 7, // 1 week
			path: '/',
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			secrets: [resolvedSessionSecret]
		}
	})

export async function getThemeModeFromRequest(
	request: Request
): Promise<ThemeMode> {
	const themeSession = await getSession(request.headers.get('Cookie'))
	const themeMode = themeSession.get('themeMode')

	if (themeMode === 'light' || themeMode === 'dark' || themeMode === 'system') {
		return themeMode
	}

	return 'system'
}

export { getSession, commitSession, destroySession }
