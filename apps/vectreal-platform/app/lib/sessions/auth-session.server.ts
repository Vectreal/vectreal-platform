import { createCookieSessionStorage } from 'react-router'

type SessionData = {
	idt: string // JWT token
}

type SessionFlashData = {
	error: string
}

// Set session expiration to 7 days.
const days = 7
const expiresIn = 60 * 60 * 24 * days

const { getSession, commitSession, destroySession } =
	createCookieSessionStorage<SessionData, SessionFlashData>({
		// a Cookie from `createCookie` or the CookieOptions to create one
		cookie: {
			name: 'auth-session',

			// Expires can also be set (although maxAge overrides it when used in combination).
			// Note that this method is NOT recommended as `new Date` creates only one date on each server deployment, not a dynamic date in the future!
			//
			// expires: new Date(Date.now() + 60_000),
			httpOnly: true,
			maxAge: expiresIn,
			path: '/',
			sameSite: 'lax',
			secrets: ['s3cret1']
		}
	})

export { getSession, commitSession, destroySession }
