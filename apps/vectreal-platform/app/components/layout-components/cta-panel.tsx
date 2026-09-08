import { cn } from '@shared/utils'

import BasicCard from './basic-card'

import type { ReactNode } from 'react'

interface CtaPanelProps {
	heading: ReactNode
	description?: ReactNode
	actions: ReactNode
	className?: string
}

/**
 * The "keep going" panel at the foot of a reading page.
 *
 * The newsroom index and the article page each had their own, agreeing on
 * neither the eyebrow tracking (`wider` vs `0.14em`), the heading size
 * (`text-2xl md:text-3xl` twice, from two different raw scales) nor the gap
 * between the parts.
 *
 * There is no eyebrow any more. Both call sites filled it with a slogan -
 * "Built for makers shipping in 3D", "Build while you're learning" - rendered
 * in caps above a heading that already said the same thing. An eyebrow is a
 * label for what follows; when there is nothing to label, it is decoration
 * wearing a label's clothes.
 */
export function CtaPanel({
	heading,
	description,
	actions,
	className
}: CtaPanelProps) {
	return (
		<BasicCard
			as="section"
			cardClassName="flex flex-col gap-4 p-6 md:p-8"
			className={cn(className)}
		>
			<h2 className="text-h3 font-heading max-w-2xl">{heading}</h2>

			{description ? (
				<p className="text-muted-foreground text-body max-w-2xl">
					{description}
				</p>
			) : null}

			<div className="flex flex-wrap items-center gap-2">{actions}</div>
		</BasicCard>
	)
}
