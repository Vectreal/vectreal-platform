import { cn } from '@shared/utils'

import BasicCard from './basic-card'

import type { ReactNode } from 'react'

interface CtaPanelProps {
	eyebrow?: string
	heading: ReactNode
	description?: ReactNode
	/** Badges or similar, shown between the description and the actions. */
	aside?: ReactNode
	actions: ReactNode
	className?: string
}

/**
 * The "keep going" panel at the foot of a reading page.
 *
 * The newsroom index and the article page each had their own, agreeing on
 * neither the eyebrow tracking (`wider` vs `0.14em`), the heading size
 * (`text-2xl md:text-3xl` twice, from two different raw scales) nor the gap
 * between the parts. Both also coloured the eyebrow `text-primary`, which is
 * plain foreground - the accent never rendered.
 */
export function CtaPanel({
	eyebrow,
	heading,
	description,
	aside,
	actions,
	className
}: CtaPanelProps) {
	return (
		<BasicCard
			as="section"
			cardClassName="flex flex-col gap-4 p-6 md:p-8"
			className={cn(className)}
		>
			{eyebrow ? <p className="text-orange text-eyebrow">{eyebrow}</p> : null}

			<h2 className="text-h3 max-w-2xl">{heading}</h2>

			{description ? (
				<p className="text-muted-foreground max-w-2xl leading-relaxed">
					{description}
				</p>
			) : null}

			{aside ? (
				<div className="flex flex-wrap items-center gap-1.5">{aside}</div>
			) : null}

			<div className="flex flex-wrap items-center gap-2">{actions}</div>
		</BasicCard>
	)
}
