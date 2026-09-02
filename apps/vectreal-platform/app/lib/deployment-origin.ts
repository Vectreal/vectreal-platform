import { SITE_URL } from './seo'

/**
 * Which origin this particular deployment answers on, and whether it is the one
 * the public is meant to find.
 *
 * `SITE_URL` cannot answer either question. It is `import.meta.env`, so Vite
 * inlines it at build time, and one image is built per commit and deployed to
 * both Fly apps - a build-time constant is the same value on staging and on
 * production by construction. That is correct for canonical tags, which should
 * always name the canonical host whichever environment served the page, and
 * wrong for `robots.txt`, which is per-environment instruction to a crawler.
 *
 * `APPLICATION_URL` is a runtime Fly secret set per app by
 * `setup-fly-secrets.sh`, so it is the one value that differs. Reading it needs
 * these routes to render per request rather than being prerendered, which is
 * why they are no longer in `react-router.config.ts`'s prerender list.
 *
 * Deliberately not `ENVIRONMENT`, though that is also set per app. The failure
 * mode decides it: an unset or unreadable variable must never cause production
 * to tell crawlers to go away. Everything below falls back to the canonical
 * site, so the worst case is a mirror staying crawlable - what happens today -
 * rather than production deindexing itself.
 *
 * That fallback has to cover more than "absent". `robots.txt` answers with
 * `s-maxage=86400`, and those headers now reach Cloudflare (a prerendered
 * resource route had its `Response` headers discarded, so they never did
 * before). A wrong answer is therefore cached at the edge for a day and needs a
 * manual purge, which is why the comparison below is by host rather than by
 * string: a stray path, a `http://`, an uppercase letter or a trailing slash on
 * production's `APPLICATION_URL` must not read as "this is a mirror".
 */

/**
 * The origin of a URL-shaped string, or null when it is not one.
 *
 * `URL` does the normalizing that hand-rolled trimming kept missing: it
 * lowercases the host, drops any path, query and trailing slash, and rejects a
 * bare `vectreal.com` outright - which matters because the return value is
 * interpolated straight into the sitemap's `<loc>` elements, and a `<loc>`
 * without a scheme invalidates the whole document.
 */
function parseOrigin(value: string | undefined): string | null {
	if (!value) {
		return null
	}

	try {
		const url = new URL(value.trim())

		return url.protocol === 'http:' || url.protocol === 'https:'
			? url.origin
			: null
	} catch {
		return null
	}
}

/** Host alone, so `http` vs `https` cannot read as a different site. */
function hostOf(value: string): string | null {
	const origin = parseOrigin(value)

	return origin ? new URL(origin).host : null
}

/**
 * The public origin of the running deployment.
 *
 * Falls back to the canonical site rather than to the request, because a
 * request-derived origin is whatever host the caller sent - including one an
 * attacker chose - and this value is emitted into documents crawlers trust.
 * (`llms.txt` does derive its origin from the request and is untouched here;
 * the three crawl documents do not yet agree on this.)
 */
export function resolveDeploymentOrigin(
	applicationUrl: string | undefined = process.env.APPLICATION_URL
): string {
	return parseOrigin(applicationUrl) ?? SITE_URL
}

/**
 * True when this deployment is the site the public should reach.
 *
 * Everything else - staging, a preview app, a developer's machine - is a
 * mirror of it, and a crawled mirror competes with the real thing.
 *
 * An origin that cannot be parsed counts as canonical. That is the fail-open
 * direction described above: misconfiguration leaves the site indexed.
 */
export function isCanonicalDeployment(
	origin: string = resolveDeploymentOrigin()
): boolean {
	const host = hostOf(origin)

	return host === null || host === hostOf(SITE_URL)
}
