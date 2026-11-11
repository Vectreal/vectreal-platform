import { Button } from '@shared/components/ui/button'

import {
	domainNotAllowedDescription,
	EMBED_ERROR_COPY,
	type EmbedErrorKind
} from '../../lib/errors/error-state-copy'
import { ErrorState } from '../error-state'

/**
 * What an embed shows when it cannot show the scene: a refusal, a malformed
 * URL, a rate limit, or a load that failed.
 *
 * One component for all of them, sized for the customer's iframe. The only
 * action it ever offers is "Try again", and only for a failure that might be
 * transient. Go Back was here once and moved the iframe, not the page; a link
 * would load our site into theirs.
 */
export function EmbedErrorState({
	kind,
	refusedHost = null,
	onRetry
}: {
	kind: EmbedErrorKind
	/** The host a domain refusal named; read only for that kind. */
	refusedHost?: string | null
	onRetry?: () => void
}) {
	const copy = EMBED_ERROR_COPY[kind]
	const description =
		kind === 'domain_not_allowed'
			? domainNotAllowedDescription(refusedHost)
			: copy.description

	return (
		<ErrorState
			size="frame"
			heading={copy.heading}
			description={description}
			action={
				copy.retryable && onRetry ? (
					<Button type="button" onClick={onRetry}>
						Try again
					</Button>
				) : undefined
			}
		/>
	)
}
