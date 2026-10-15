import { Button } from '@shared/components/ui/button'
import { Link, useLocation } from 'react-router'

import { ErrorState } from './error-state'
import {
	PUBLIC_ERROR_COPY,
	publicErrorKind,
	type PublicErrorKind,
	routeErrorDetail
} from '../lib/errors/error-state-copy'
import { buildMeta } from '../lib/seo'

/**
 * Every public error, at page size: the site-wide 404, a loader's thrown 403
 * or 404, and anything that reaches a public boundary or the root fallback.
 *
 * A 404 echoes the requested path back, because it is the one specific thing
 * this page knows and a mistyped address is easiest to spot when shown. A
 * response body a loader wrote on purpose replaces the generic description;
 * an exception's message never does.
 */
function PublicErrorState({
	kind,
	detail
}: {
	kind: PublicErrorKind
	detail?: string
}) {
	const { pathname } = useLocation()
	const copy = PUBLIC_ERROR_COPY[kind]

	const description =
		detail ??
		(kind === 'not_found' ? (
			<>
				Nothing lives at{' '}
				<code className="text-foreground break-all">{pathname}</code>.{' '}
				{copy.description}
			</>
		) : (
			copy.description
		))

	const home = (
		<Link to="/" viewTransition>
			Go to the home page
		</Link>
	)

	return (
		<ErrorState
			size="page"
			heading={copy.heading}
			description={description}
			actions={
				kind === 'server_error' ? (
					<>
						<Button type="button" onClick={() => window.location.reload()}>
							Try again
						</Button>
						<Button asChild variant="ghost">
							{home}
						</Button>
					</>
				) : (
					<>
						<Button asChild>{home}</Button>
						<Button asChild variant="ghost">
							<Link to="/docs" viewTransition>
								Read the docs
							</Link>
						</Button>
					</>
				)
			}
		/>
	)
}

/**
 * A caught route error as the public error page. A loader's own string body
 * replaces the description, except on a 404, where the requested path says
 * more than "not found" can.
 */
export function RouteErrorState({ error }: { error: unknown }) {
	const kind = publicErrorKind(error)
	return (
		<PublicErrorState
			kind={kind}
			detail={kind === 'not_found' ? undefined : routeErrorDetail(error)}
		/>
	)
}

/** The site-wide `*` route's page. */
export function NotFound() {
	return <PublicErrorState kind="not_found" />
}

const ERROR_PAGE_TITLE: Record<PublicErrorKind, string> = {
	not_found: 'Page not found',
	forbidden: 'Access denied',
	server_error: 'Something went wrong'
}

/** Kept out of search results, and with no canonical pointing anywhere. */
function errorPageMeta(kind: PublicErrorKind) {
	return buildMeta(
		[{ title: `${ERROR_PAGE_TITLE[kind]} - Vectreal` }],
		undefined,
		{ private: true }
	)
}

export const notFoundMeta = () => errorPageMeta('not_found')

/**
 * For a route's `meta` when its boundary caught `error`. A route that owns a
 * boundary gets only its own meta and its parents', never a child's, so each
 * one has to check: otherwise the error state ships with the page's `index`
 * and canonical.
 */
export const routeErrorMeta = (error: unknown) =>
	errorPageMeta(publicErrorKind(error))
