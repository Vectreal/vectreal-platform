import { Button } from '@shared/components/ui/button'
import { data, Link, useLocation } from 'react-router'

import { ErrorState } from '../../components/error-state'
import { notFoundMeta } from '../../components/not-found'
import { PUBLIC_ERROR_COPY } from '../../lib/errors/error-state-copy'

/**
 * An unknown page under `/docs`.
 *
 * Returned rather than thrown, unlike the site-wide 404, so the docs layout
 * and its sidebar stay on screen: a reader who mistyped a docs URL is one
 * click from the page they meant. Inset, because that layout already owns the
 * page's `<main>`.
 */
export function loader() {
	return data(null, { status: 404 })
}

/*
  Its own, because a leaf without meta inherits the docs layout's, which marks
  every docs URL indexable and canonical to itself.
*/
export const meta = notFoundMeta

export default function DocsNotFoundPage() {
	const { pathname } = useLocation()
	const copy = PUBLIC_ERROR_COPY.not_found

	return (
		<ErrorState
			size="inset"
			heading="This docs page does not exist"
			description={
				<>
					Nothing lives at{' '}
					<code className="text-foreground break-all">{pathname}</code>.{' '}
					{copy.description}
				</>
			}
			actions={
				<>
					<Button asChild>
						<Link to="/docs" viewTransition>
							Documentation home
						</Link>
					</Button>
					<Button asChild variant="ghost">
						<Link to="/docs/getting-started" viewTransition>
							Getting started
						</Link>
					</Button>
				</>
			}
		/>
	)
}
