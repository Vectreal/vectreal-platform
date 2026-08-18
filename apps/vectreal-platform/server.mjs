import { createRequestHandler } from '@react-router/express'
import compression from 'compression'
import express from 'express'
import morgan from 'morgan'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

/**
 * Production server.
 *
 * This replaces `react-router-serve` for one reason: the URL a page is
 * advertised at has to be the URL that answers. `react-router-serve` mounts
 * `express.static` with its default directory handling, and prerendered pages
 * are emitted as `<route>/index.html`, so a request for `/docs` was treated as
 * a directory and answered with `301 -> /docs/`.
 *
 * That split is what broke indexing: the sitemap and `<link rel="canonical">`
 * both declare the no-slash form, so crawlers reached a redirect at the URL we
 * advertise, then found a canonical pointing back at that redirect from the URL
 * they were sent to. Neither form could be indexed.
 *
 * Resolving prerendered HTML by path rather than by directory is what fixes
 * that: the advertised URL answers 200 and its canonical points at itself.
 *
 * The trailing-slash spelling still answers too, and deliberately is not
 * redirected. Normalizing it would mean handing a request-derived value to a
 * browser in a `Location` header, and the canonical tag already tells crawlers
 * which of the two spellings counts.
 */

const ROOT = path.join(import.meta.dirname, '..', '..')
const BUILD_DIR = path.join(ROOT, 'build', 'apps', 'vectreal-platform')
const CLIENT_DIR = path.join(BUILD_DIR, 'client')

const build = await import(
	path.join(BUILD_DIR, 'server', 'index.js')
)

const app = express()

app.disable('x-powered-by')
app.use(compression())

/**
 * Every route that was prerendered, collected once at boot.
 *
 * Reading the filesystem per request would answer the same question every time
 * (the build output cannot change while the server runs) and would let a
 * stream of requests for made-up paths drive a stat call each. The set is
 * small: one entry per prerendered page.
 */
function collectPrerenderedRoutes(dir, base = '') {
	const routes = new Set()

	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue

		const route = `${base}/${entry.name}`

		if (existsSync(path.join(dir, entry.name, 'index.html'))) routes.add(route)

		for (const nested of collectPrerenderedRoutes(
			path.join(dir, entry.name),
			route
		)) {
			routes.add(nested)
		}
	}

	return routes
}

const PRERENDERED_ROUTES = collectPrerenderedRoutes(CLIENT_DIR)

// Resolve prerendered pages by path, so `/docs` serves `docs/index.html`
// without express.static ever seeing a directory to redirect to.
app.use((req, res, next) => {
	if (req.method !== 'GET' && req.method !== 'HEAD') return next()

	const [pathname, search = ''] = req.url.split('?')

	if (!PRERENDERED_ROUTES.has(pathname)) return next()

	req.url = search
		? `${pathname}/index.html?${search}`
		: `${pathname}/index.html`

	next()
})

app.use(
	'/assets',
	express.static(path.join(CLIENT_DIR, 'assets'), {
		immutable: true,
		maxAge: '1y'
	})
)
app.use(express.static(CLIENT_DIR, { redirect: false }))
app.use(morgan('tiny'))

app.all(
	'/{*splat}',
	createRequestHandler({ build, mode: process.env.NODE_ENV })
)

const port = Number(process.env.PORT) || 3000

app.listen(port, () => {
	console.log(`[vectreal-platform] http://localhost:${port}`)
})
