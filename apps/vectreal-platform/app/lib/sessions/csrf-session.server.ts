// app/utils/csrf.server.ts
import { createCookie } from 'react-router' // or cloudflare/deno
import { CSRF } from 'remix-utils/csrf/server'

const csrfSecret = process.env.CSRF_SECRET ?? process.env.SESSION_SECRET

if (!csrfSecret && process.env.NODE_ENV === 'production') {
	throw new Error('CSRF secret is required in production')
}

const resolvedCsrfSecret = csrfSecret || 'dev-only-csrf-secret'

export const cookie = createCookie('csrf', {
	path: '/',
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	//   secure: process.env.NODE_ENV === "production",
	//   domain:
	//     process.env.NODE_ENV === "production"
	//       ? "mlb-highlights-app-213367242213.us-central1.run.app"
	//       : "localhost",
	sameSite: 'lax',
	secrets: [resolvedCsrfSecret]
})

export const csrfSession = new CSRF({
	cookie,
	// what key in FormData objects will be used for the token, defaults to `csrf`
	formDataKey: 'csrf',
	// an optional secret used to sign the token, recommended for extra safety
	secret: resolvedCsrfSecret
})
