import { Button } from '@shared/components/ui/button'

import {
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
	onRetry
}: {
	kind: EmbedErrorKind
	onRetry?: () => void
}) {
	const copy = EMBED_ERROR_COPY[kind]

	return (
		<ErrorState
			size="frame"
			heading={copy.heading}
			description={copy.description}
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
