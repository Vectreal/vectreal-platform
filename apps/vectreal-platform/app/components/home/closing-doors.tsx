import { Button } from '@shared/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { Fragment } from 'react'
import { Link } from 'react-router'

import { ArrowLink } from './arrow-link'
import { CameraDrawing, CameraObject } from './camera-drawing'
import {
	HOME_PAGE_COPY,
	PILOT_CONTACT_HREF
} from '../../constants/product-copy'

const COPY = HOME_PAGE_COPY.closing

/**
 * The page's last word and its strongest invitation: the one place, after
 * everything above has made the case, that asks the reader to bring their own
 * product.
 *
 * Set a step under the hero's scale rather than as a pair of footnotes, so it
 * reads as the page's call to action and not as the start of the footer,
 * without shouting over the sections above it. Beside it is
 * the hero's camera cut down the middle, drawn on one side and rendered on the
 * other, split by the orange line the hero inks it with: the file the reader
 * brings, and what it becomes. The developer's door stays, as one line under
 * the company's, so nobody reaches the footer without one.
 */
export const ClosingDoors = () => (
	<div className="flex flex-col gap-16">
		<div className="grid items-center gap-16 lg:grid-cols-[1.1fr_1fr] lg:gap-24">
			<div>
				<h2 className="text-headline" data-reveal>
					{/* The space keeps the lines apart in the text itself, for copy and search. */}
					{COPY.heading.map((line, i) => (
						<Fragment key={line}>
							{i > 0 && ' '}
							<span className="block">{line}</span>
						</Fragment>
					))}
				</h2>
				<p
					className="text-muted-foreground text-body-lg mt-6 max-w-lg"
					data-reveal
				>
					{COPY.body}
				</p>
				<div className="mt-8 flex flex-col gap-4 sm:flex-row" data-reveal>
					<Button asChild size="lg" variant="brand">
						<Link to={PILOT_CONTACT_HREF}>
							{COPY.primaryCta}
							<ArrowRight aria-hidden="true" />
						</Link>
					</Button>
					<Button asChild size="lg" variant="secondary">
						<Link to="/publisher" viewTransition>
							{COPY.secondaryCta}
						</Link>
					</Button>
				</div>
			</div>

			<figure aria-hidden="true" className="relative" data-reveal>
				<CameraDrawing />
				{/* Wrapped: the object's own module sets it `relative`, which would win over a utility. */}
				<div className="absolute inset-0 [clip-path:inset(0_0_0_50%)]">
					<CameraObject />
				</div>
				<span className="bg-orange absolute inset-y-[-8%] left-1/2 w-px" />
				<span className="text-eyebrow text-muted-foreground absolute bottom-[-12%] left-0">
					{COPY.figure.file}
				</span>
				<span className="text-eyebrow text-orange-ink absolute right-0 bottom-[-12%]">
					{COPY.figure.page}
				</span>
			</figure>
		</div>

		<p
			className="text-muted-foreground text-body flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
			data-reveal
		>
			{COPY.developers.lead}
			<ArrowLink to="/docs" className="text-foreground">
				{COPY.developers.cta}
			</ArrowLink>
		</p>
	</div>
)
