import { redirect } from 'react-router'

import { Route } from './+types/docs-moved'

/**
 * Docs pages that moved when the docs split into "In the browser" and "In
 * your code", and where each one lives now.
 *
 * The repo setup that used to open "Getting started" moved to `self-hosting`,
 * and the publisher walkthrough took its place at `/docs/getting-started`.
 * Permanent, so links in READMEs on npm, articles and search results land on
 * the page and pass their weight to it. Served by the app, as the legal short
 * links are, so the redirect ships and is tested with the move.
 */
export const DOCS_MOVED: Record<string, string> = {
	'/docs/getting-started/first-model': '/docs/getting-started',
	'/docs/getting-started/installation': '/docs/self-hosting/installation',
	'/docs/operations/deployment': '/docs/self-hosting/deployment'
}

export function loader({ request }: Route.LoaderArgs) {
	const { pathname, search } = new URL(request.url)
	const target = DOCS_MOVED[pathname.replace(/\/$/, '')]
	if (!target) throw new Response('Not Found', { status: 404 })
	return redirect(`${target}${search}`, 301)
}
