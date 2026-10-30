import compression from 'compression'
import express from 'express'
import morgan from 'morgan'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

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

/**
 * Every file /media serves that public/assets used to, by the path it had
 * there, collected once at boot like the prerendered routes above.
 *
 * For links already shared under the old paths: an article's OG image in a
 * post, say. A lookup rather than a path built from the request, so the
 * Location header only ever carries a path this server wrote, and a stream of
 * made-up paths costs no filesystem call.
 */
function collectMovedMedia(dir, base) {
	const moved = new Map()
	if (!existsSync(dir)) return moved

	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const rel = `${base}/${entry.name}`
		if (entry.isDirectory()) {
			for (const [from, to] of collectMovedMedia(
				path.join(dir, entry.name),
				rel
			)) {
				moved.set(from, to)
			}
		} else if (entry.isFile()) {
			moved.set(`/assets${rel}`, `/media${rel}`)
		}
	}

	return moved
}

/**
 * The production server's Express app, apart from `server.mjs` so a test can
 * mount it on a fixture build directory.
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
export function createServerApp({
	clientDir,
	handleRequest,
	isUnpublishedNewsPath
}) {
	const app = express()

	app.disable('x-powered-by')
	app.use(compression())

	/*
	  A scheduled article's prerendered files are in the build from the day it
	  is deployed, because staging shows it early from the same image. Until
	  its `publishedAt`, production must answer them exactly as it answers an
	  article that does not exist, so this runs before anything that serves a
	  file: the app renders its own 404 for them, with `no-store` so the edge
	  cannot keep that 404 past the publish time. The rule is the app's
	  (`isUnpublishedNewsPath` in `news-manifest.server.ts`), read from the
	  server build so there is one copy of it.
	*/
	app.use((req, res, next) => {
		if (!isUnpublishedNewsPath(req.path)) return next()
		handleRequest(req, res, next)
	})

	const PRERENDERED_ROUTES = collectPrerenderedRoutes(clientDir)

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

	/*
	  Two kinds of static file, told apart by where they live.

	  /assets is Vite's: every file in it is named for its content, so it is
	  immutable for a year, here and at Cloudflare's edge (terraform/cloudflare.tf,
	  Rule 1). Nothing else may live there. public/assets used to, and its files
	  kept their names when their content changed, so a recaptured screenshot
	  stayed cached for a year at the edge and on every device that had seen the
	  old one. tests/public-assets-namespace.spec.ts keeps that folder from coming
	  back.

	  /media holds the files that keep their name, served fresh for five minutes,
	  which Cloudflare respects (Rule 2), so an edit reaches everyone within that.
	*/
	const MEDIA_DIR = path.join(clientDir, 'media')

	const MOVED_MEDIA = new Map([
		...collectMovedMedia(path.join(MEDIA_DIR, 'images'), '/images'),
		...collectMovedMedia(path.join(MEDIA_DIR, 'models'), '/models')
	])

	app.use((req, res, next) => {
		const target = MOVED_MEDIA.get(req.path)
		if (!target) return next()
		res.redirect(301, target)
	})

	app.use(
		'/assets',
		express.static(path.join(clientDir, 'assets'), {
			immutable: true,
			maxAge: '1y'
		})
	)
	app.use(
		'/media',
		express.static(MEDIA_DIR, { maxAge: '5m', redirect: false })
	)
	// The Draco decoder, the KTX2 transcoder and the KTX2 encoder keep their file
	// names across upgrades, so they get a day rather than a year; purge
	// /draco/*, /basis/* or /basis-encoder/* at the edge after replacing one.
	for (const codecDir of ['draco', 'basis', 'basis-encoder']) {
		app.use(
			`/${codecDir}`,
			express.static(path.join(clientDir, codecDir), {
				maxAge: '1d',
				redirect: false
			})
		)
	}
	app.use(express.static(clientDir, { redirect: false }))
	app.use(morgan('tiny'))

	app.all('/{*splat}', handleRequest)

	return app
}
