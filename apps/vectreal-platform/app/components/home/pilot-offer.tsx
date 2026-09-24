import { Button } from '@shared/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import {
	HOME_PAGE_COPY,
	PILOT_CONTACT_HREF
} from '../../constants/product-copy'

const COPY = HOME_PAGE_COPY.pilot

/**
 * The founding-client offer, written as terms rather than as features.
 *
 * Three columns of unequal width because they say unequal amounts: what we do
 * carries the substance, so it gets the room. A hairline over each column
 * separates them without drawing a box around any of them.
 */
export const PilotOffer = () => (
	<div className="flex flex-col gap-16">
		<div className="max-w-2xl">
			<h2 id="pilot-heading" className="text-headline" data-reveal>
				{COPY.heading}
			</h2>
			<p className="text-muted-foreground text-body-lg mt-8" data-reveal>
				{COPY.lead}
			</p>
		</div>

		<div className="grid gap-8 lg:grid-cols-[1fr_1.4fr_1fr]" data-reveal>
			{COPY.blocks.map((block) => (
				<div key={block.title} className="flex flex-col gap-4">
					<span className="ds-divider h-px w-full" aria-hidden="true" />
					<h3 className="text-h4 pt-4">{block.title}</h3>
					<p className="text-muted-foreground text-body">{block.body}</p>
				</div>
			))}
		</div>

		<div
			className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between"
			data-reveal
		>
			<p className="text-foreground text-body max-w-md">{COPY.team}</p>
			<Button asChild size="lg" className="w-full sm:w-fit">
				<Link to={PILOT_CONTACT_HREF}>
					{COPY.cta}
					<ArrowRight aria-hidden="true" />
				</Link>
			</Button>
		</div>
	</div>
)
