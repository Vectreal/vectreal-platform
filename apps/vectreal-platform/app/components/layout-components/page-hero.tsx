import { cn } from '@shared/utils'
import { type ReactNode } from 'react'

interface PageHeroProps {
	heading: ReactNode
	description?: ReactNode
	actions?: ReactNode
	className?: string
}

/**
 * Shared above-the-fold hero section used by all main nav pages
 * (docs, contact, newsroom, pricing). Encodes the brand-aligned design spec in
 * one place - typography scale, description, and an actions slot.
 *
 * The heading sits on the display rung, not headline. With the eyebrow gone and
 * no imagery on most of these pages, the heading is the visual event at the top
 * of the page, and the type is the instrument doing that job rather than a
 * decoration added beside it.
 *
 * There was a label above the heading, and every page passed its own name into
 * it, in caps. The nav already marks the current page and the H1 already says
 * what the page is, so it was the third statement of one fact. A reflexive
 * all-caps label above a heading is a templated-layout tell in its own right,
 * which is why the prop is gone rather than merely unused.
 */
const PageHero = ({
	heading,
	description,
	actions,
	className
}: PageHeroProps) => {
	return (
		<div className={cn('relative isolate overflow-hidden', className)}>
			{/*
			  And there is no gradient either. A brand-tinted wash sat behind all
			  four page heads, carrying no information - the one place in the
			  system where the accent was pure decoration, which is what "one
			  accent, doing one job" exists to prevent. The heading is the thing
			  the top of the page is for.

			  There were also two decorative radial accents here. They never rendered:
			  the colour was written `hsl(var(--orange)/0.14)`, but --orange is a
			  hex rather than HSL channels, so the whole `radial-gradient()` failed
			  to parse. Every hero has shipped without them.

			  Removed rather than repaired. Making them work restores a look nobody
			  reviewed - at their written strength they wash the panel brown and
			  leave a step where the hero meets the page. If a glow is ever wanted,
			  it should be designed against a real hero, and
			  `rgb(var(--orange-rgb) / <alpha>)` is the spelling that works.
			*/}
			{/*
			  On the rhythm: 128 above, 64 below. pt-24 was 96px, a value used
			  nowhere else, and this hero is the most-seen block on the marketing
			  surfaces. The asymmetry is the point - the space above separates the
			  hero from the fixed nav, the space below joins it to the page it
			  introduces.
			*/}
			<div className="container-page pt-32 pb-16">
				<div className="space-y-4">
					<h1 className="text-display font-heading max-w-4xl">{heading}</h1>

					{description && (
						<p className="text-muted-foreground text-body-lg max-w-3xl">
							{description}
						</p>
					)}

					{actions && (
						<div className="flex flex-wrap items-center gap-2 pt-2">
							{actions}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export default PageHero
