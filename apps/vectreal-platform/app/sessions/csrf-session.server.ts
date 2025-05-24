// app/utils/csrf.server.ts
import { createCookie } from 'react-router' // or cloudflare/deno
import { CSRF } from 'remix-utils/csrf/server'

export const cookie = createCookie('csrf', {
	path: '/',
	httpOnly: true,
	//   secure: process.env.NODE_ENV === "production",
	//   domain:
	//     process.env.NODE_ENV === "production"
	//       ? "mlb-highlights-app-213367242213.us-central1.run.app"
	//       : "localhost",
	sameSite: 'lax',
	secrets: ['s3cr3t']
})

export const csrfSession = new CSRF({
	cookie,
	// what key in FormData objects will be used for the token, defaults to `csrf`
	formDataKey: 'csrf',
	// an optional secret used to sign the token, recommended for extra safety
	secret: 's3cr3t'
})
