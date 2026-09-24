import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import {
	HOME_PAGE_COPY,
	PILOT_CONTACT_HREF
} from '../../constants/product-copy'

const COPY = HOME_PAGE_COPY.closing

const DOORS = [
	{ ...COPY.companies, to: PILOT_CONTACT_HREF },
	{ ...COPY.developers, to: '/docs' }
] as const

/**
 * The page ends by sending each of its two readers somewhere specific, the
 * same two doors the hero opened, so nobody reaches the footer without one.
 */
export const ClosingDoors = () => (
	<div className="grid gap-16 md:grid-cols-2">
		{DOORS.map((door) => (
			<div key={door.title} className="flex flex-col gap-4">
				<span className="ds-divider h-px w-full" aria-hidden="true" />
				<h2 className="text-h3 pt-4" data-reveal>
					{door.title}
				</h2>
				<p className="text-muted-foreground text-body max-w-md" data-reveal>
					{door.body}
				</p>
				<Link
					to={door.to}
					data-reveal
					className="text-foreground text-body-sm inline-flex w-fit items-center gap-1 underline-offset-4 hover:underline"
				>
					{door.cta}
					<ArrowRight className="size-3.5" aria-hidden="true" />
				</Link>
			</div>
		))}
	</div>
)
