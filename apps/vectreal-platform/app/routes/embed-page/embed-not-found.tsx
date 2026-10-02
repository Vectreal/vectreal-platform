import { data, useRouteError } from 'react-router'

import { EmbedErrorState } from '../../components/scene-embed/embed-error-state'
import { mergeEmbedResponseHeaders } from '../../lib/domain/embed/embed-response-headers'
import { useErrorReport } from '../../lib/observability/use-error-report'
import { buildMeta } from '../../lib/seo'

import type { Route } from './+types/embed-not-found'

/**
 * A malformed `/embed` URL: too few segments, or too many.
 *
 * It renders inside a customer's iframe, so it gets none of the site 404: no
 * nav, no links that would load the marketing site into somebody else's page,
 * no hero sized for a full window. It carries the embed header contract for
 * the same reason every `/embed` response does, since the URL may still hold
 * an API key. And like the embed's own 404s it does not say what was wrong,
 * because the viewer is not always the person who owns the embed.
 *
 * The 404 is thrown carrying no error, so the server does not report it, and
 * so a fetcher aimed here fails rather than resolving with `null`.
 */
export function loader(): never {
	throw data(null, { status: 404 })
}

export function action(): never {
	throw data(null, { status: 404 })
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
	return mergeEmbedResponseHeaders(loaderHeaders)
}

export const meta = () =>
	buildMeta([{ title: 'Embed not available - Vectreal' }], undefined, {
		private: true
	})

function EmbedNotFound() {
	return <EmbedErrorState kind="not_available" />
}

export default EmbedNotFound

export function ErrorBoundary() {
	useErrorReport(useRouteError())
	return <EmbedNotFound />
}
