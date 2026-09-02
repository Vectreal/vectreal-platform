/**
 * What an embed shows when the server refused it, instead of a spinner.
 *
 * The refusals worth explaining are the ones the site owner can act on, and
 * until now none of them said anything: the loader returned a 403 rather than
 * throwing, so React Router treated it as data, no boundary ran, and the viewer
 * booted anyway - a spinner, then a client fetch that failed its own auth, then
 * "Unable to Load Scene Preview" with a Retry that retries nothing and a Go
 * Back that does nothing inside an iframe.
 *
 * Sized for an iframe, which is the only place this renders. No navigation
 * controls for the same reason: there is nowhere to go back to.
 */

import type { FC } from 'react'

export type EmbedRefusalReason = 'domain_not_allowed'

/**
 * One entry per reason a refusal is explained rather than hidden.
 *
 * Deliberately not every failure. A bad token, a missing scene and an
 * unpublished scene all answer 404 and stay unexplained, because the person
 * looking at a broken embed is not always the person who owns it - and naming
 * which of those it was tells an unknown visitor whether an id exists.
 *
 * `domain_not_allowed` is the exception, and only reachable after a live key
 * matched this project: the caller already proved they hold it, so the message
 * tells them nothing they had not established. It also fires before the scene
 * is looked up, so it says nothing about whether that scene exists.
 */
const REFUSAL_COPY: Record<
	EmbedRefusalReason,
	{ title: string; detail: string; action: string }
> = {
	domain_not_allowed: {
		title: 'This site is not allowed to show this embed',
		detail:
			'The key is valid, but the page requesting it is not on the allowed domain list for this project.',
		/*
		  Names the fix without naming the list. Echoing the allowed domains back
		  would hand an unknown visitor the inventory of every site the owner
		  embeds on, for no gain to the owner - who can already read it on the page
		  where they would go to change it.
		*/
		action:
			'If you own this project, add this site to its allowed domains in the Vectreal dashboard.'
	}
}

export const EmbedRefusal: FC<{ reason: EmbedRefusalReason }> = ({
	reason
}) => {
	const copy = REFUSAL_COPY[reason]

	return (
		<div className="bg-background flex h-dvh w-full items-center justify-center p-6">
			<div className="border-border bg-card w-full max-w-md space-y-3 rounded-2xl border p-6">
				<h1 className="text-h4">{copy.title}</h1>
				<p className="text-muted-foreground text-sm">{copy.detail}</p>
				<p className="text-muted-foreground text-sm">{copy.action}</p>
			</div>
		</div>
	)
}
