import { cn } from '@shared/utils'
import { type ReactNode } from 'react'

interface PageHeroProps {
	eyebrow?: string
	heading: ReactNode
	description?: ReactNode
	actions?: ReactNode
	className?: string
}

/**
 * Shared above-the-fold hero section used by all main nav pages
 * (docs, contact, newsroom, pricing). Encodes the brand-aligned
 * design spec in one place - gradient background, typography scale,
 * eyebrow label, description, and an actions slot.
 */
const PageHero = ({
	eyebrow,
	heading,
	description,
	actions,
	className
}: PageHeroProps) => {
	return (
		<div
			className={cn(
				'from-orange/10 relative isolate overflow-hidden bg-linear-to-b via-transparent to-transparent',
				className
			)}
		>
			{/*
			  There were two decorative radial accents here. They never rendered:
			  the colour was written `hsl(var(--orange)/0.14)`, but --orange is a
			  hex rather than HSL channels, so the whole `radial-gradient()` failed
			  to parse. Every hero has shipped without them.

			  Removed rather than repaired. Making them work restores a look nobody
			  reviewed - at their written strength they wash the panel brown and
			  leave a step where the hero meets the page. The top fade above is the
			  hero's actual accent. If a glow is wanted, it should be designed
			  against a real hero, and `rgb(var(--orange-rgb) / <alpha>)` is the
			  spelling that works.
			*/}
			<div className="mx-auto max-w-7xl px-6 pt-24 pb-16">
				<div className="space-y-4">
					{eyebrow && (
						<p className="text-muted-foreground text-xs font-semibold tracking-[0.22em] uppercase">
							{eyebrow}
						</p>
					)}

					<h1 className="max-w-4xl text-4xl leading-[1.02] font-medium tracking-tight text-balance md:text-6xl">
						{heading}
					</h1>

					{description && (
						<p className="text-muted-foreground max-w-3xl text-base leading-relaxed md:text-lg">
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
