import { useId, type ReactNode } from 'react'

import { PageHero } from './layout-components'

/**
 * The one way an error looks, on every public and embed surface.
 *
 * Three sizes, chosen by where the state renders rather than by how bad the
 * failure is:
 *
 * - `page` owns the page: the marketing hero, display type, and the `<main>`
 *   landmark. Every public boundary renders at this level, either replacing a
 *   layout that had its own `<main>` or under nav-layout, which has none.
 * - `inset` renders inside a layout that already owns `<main>`, such as the
 *   docs sidebar layout, so it is a labelled `<section>` with no hero padding.
 * - `frame` fills a customer's iframe. It never carries a link, which would
 *   load our site into their page, and takes at most one action.
 *
 * No card, border or icon: the heading carries the state, as the brand rules
 * ask of every surface.
 */
type ErrorStateProps = { heading: string; description: ReactNode } & (
	| { size: 'page' | 'inset'; actions?: ReactNode }
	// One button, and typed apart from `actions` so a row of links cannot be
	// passed into a frame by habit.
	| { size: 'frame'; action?: ReactNode }
)

export function ErrorState(props: ErrorStateProps) {
	const headingId = useId()

	if (props.size === 'frame') {
		return (
			<main className="bg-background flex h-dvh w-full flex-col items-center justify-center gap-2 p-6 text-center">
				<h1 className="text-h4 max-w-sm">{props.heading}</h1>
				<p className="text-muted-foreground text-body-sm max-w-sm">
					{props.description}
				</p>
				{props.action && <div className="pt-3">{props.action}</div>}
			</main>
		)
	}

	if (props.size === 'page') {
		return (
			<main>
				<PageHero
					heading={props.heading}
					description={props.description}
					actions={props.actions}
				/>
			</main>
		)
	}

	return (
		<section aria-labelledby={headingId} className="space-y-4 py-16">
			<h1 id={headingId} className="text-h2 max-w-2xl">
				{props.heading}
			</h1>
			<p className="text-muted-foreground text-body max-w-2xl">
				{props.description}
			</p>
			{props.actions && (
				<div className="flex flex-wrap items-center gap-2 pt-2">
					{props.actions}
				</div>
			)}
		</section>
	)
}
