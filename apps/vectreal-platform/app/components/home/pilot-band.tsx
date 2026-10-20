import { Button } from '@shared/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { HOME_PAGE_COPY } from '../../constants/product-copy'

const COPY = HOME_PAGE_COPY.pilot

/**
 * The free-model offer, first under the hero: what we do for a brand that has
 * photos of its products and no 3D files, which is most of them.
 *
 * The offer and its call to action on one side, the three steps on the other
 * as ruled rows, numbered because they happen in that order. On a phone they
 * stack, the steps under the button.
 */
export const PilotBand = () => (
	<div className="flex flex-col gap-12">
		<div className="grid items-start gap-16 lg:grid-cols-[5fr_6fr] lg:gap-24">
			<div>
				<h2 id="pilot-heading" className="text-headline" data-reveal>
					{COPY.heading}
				</h2>
				<p
					className="text-muted-foreground text-body-lg mt-8 max-w-xl"
					data-reveal
				>
					{COPY.lead}
				</p>
				<div
					className="mt-10 flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-center"
					data-reveal
				>
					<Button
						asChild
						size="lg"
						variant="brand"
						className="tap-target relative w-full sm:w-fit"
					>
						<Link to="/free-model">
							{COPY.cta}
							<ArrowRight aria-hidden="true" />
						</Link>
					</Button>
					<p className="text-muted-foreground text-body-sm">{COPY.afterCta}</p>
				</div>
			</div>

			<ol aria-label={COPY.stepsLabel} data-reveal>
				{COPY.steps.map((step, i) => (
					<li
						key={step.title}
						className="border-foreground/10 grid grid-cols-[3rem_1fr] gap-4 border-t py-7 last:border-b"
					>
						<span
							aria-hidden="true"
							className="text-eyebrow text-muted-foreground pt-1"
						>
							{String(i + 1).padStart(2, '0')}
						</span>
						<div className="space-y-1.5">
							<h3 className="text-body-lg text-foreground font-medium">
								{step.title}
							</h3>
							<p className="text-muted-foreground text-body">{step.body}</p>
						</div>
					</li>
				))}
			</ol>
		</div>

		<p className="text-muted-foreground text-body-sm" data-reveal>
			{COPY.note}
		</p>
	</div>
)
